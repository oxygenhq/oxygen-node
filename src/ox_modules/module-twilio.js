/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @name twilio
 * @description Provides methods for working with Twilio service.
 */
const util = require('util');
const deasync = require('deasync');
const utils = require('./utils');
import request from 'request';
import OxygenModule from '../core/OxygenModule';
import OxError from '../errors/OxygenError';
import errHelper from '../errors/helper';

const MODULE_NAME = 'twilio';

// FIXME: find good timeout
const BRIDGE_RESPONSE_TIMEOUT = 240 * 1000;

export default class TwilioModule extends OxygenModule {

    constructor(options, context, rs, logger, modules, services) {
        super(options, context, rs, logger, modules, services);

        this._client = null;
        this._callSids = [];
    }

    /*
     * @summary Gets module name
     * @function name
     * @return {String} Constant value "http".
     */
    get name() {
        return MODULE_NAME;
    }

    /**
     * @summary Set Twilio authentication details.
     * @function init
     * @param {String} accountSid - Account SID.
     * @param {String} authToken - Authentication token.
     * @param {String=} bridgeUrl - URL of the Twilio bridge service. This argument is required only for methods which deal with voice calls.
     */
    init(accountSid, authToken, bridgeUrl) {
        this._client = require('twilio')(accountSid, authToken);
        this._accountSid = accountSid;
        this._authToken = authToken;
        this._bridgeUrl = bridgeUrl;
        this._isInitialized = true;
    }

    /**
     * @summary Retrieves last SMS message.
     * @function getLastSms
     * @param {Boolean} removeOnRead - Specifies whether to delete the message after reading it.
     * @param {Number} timeout - Timeout in milliseconds for waiting for the message to arrive.
     * @param {Number=} notOlderThan - Retrieve message only if it arrived not before the given time (in ms).
     *                                 Default is 4 minutes.
     * @return {String} SMS text.
     */
    async getLastSms(removeOnRead, timeout, notOlderThan) {
        utils.assertArgumentBool(removeOnRead, 'removeOnRead');
        utils.assertArgumentNumberNonNegative(timeout, 'timeout');

        if (!notOlderThan) {
            notOlderThan = 4*60*1000;
        }
        var msg;
        var now = Date.now();
        var earliestMessageDate = new Date(now - notOlderThan);

        while (!msg && (Date.now() - now) < timeout) {
            var messages;
            try {
                messages = await this._client.messages.list({ dateSentAfter: earliestMessageDate });
            } catch (e) {
                 // ignored
            }

            if (messages && typeof messages[Symbol.iterator] === 'function') {
                for (var _msg of messages) {
                    if (_msg.direction == 'inbound') {
                        var _msgDate = Date.parse(_msg.dateCreated);
                        // if message is newer than the previous one - save it
                        if (msg && Date.parse(msg.dateCreated) < _msgDate) {
                            msg = _msg;
                        } else if (!msg) {
                            msg = _msg;
                        }
                    }
                }
            }
            deasync.sleep(800);
        }

        if (!msg) {
            throw new OxError(errHelper.errorCode.TWILIO_ERROR, "Couldn't get the SMS within " + timeout + 'ms.');
        }

        if (removeOnRead) {
            await this._client.messages(msg.sid).remove();
        }

        return msg.body;
    }

    /**
     * @summary Send an SMS.
     * @function sendSms
     * @param {String} from - Phone number to send from.
     * @param {String} to - Phone number to send to.
     * @param {String} message - Message to send.
     * @return {String} Message SID.
     * @example <caption>[javascript] Usage example</caption>
     * twilio.init('Account Sid', 'Account Token');
     * twilio.sendSms('+1xxxxxxxxxx', '+972xxxxxxxxx', 'Hello World!');
     */
    async sendSms(from, to, message) {
        utils.assertArgumentNonEmptyString(from, 'from');
        utils.assertArgumentNonEmptyString(to, 'to');
        utils.assertArgumentNonEmptyString(message, 'message');

        var msg;
        try {
            msg = await this._client.messages.create({
                body: message,
                from: from,
                to: to
            });
        } catch (e) {
            if (e.message) {
                var errorTxt = e.message;
                if (e.moreInfo) {
                    errorTxt += ' For more info: ' + e.moreInfo;
                } else if (e.code) {
                    errorTxt = 'Unable to connect to Twilio: ' + errorTxt;
                }
                throw new OxError(errHelper.errorCode.TWILIO_ERROR, errorTxt);
            }
        }

        return msg.sid;
    }

    /**
     * @summary Initiate a call
     * @function call
     * @param {String} from - Phone number to call from.
     * @param {String} to - Phone number to call.
     * @param {Boolean=} record - Specifies whether to record the call or not.
     * @param {String=} liveAudioStreamWSS - Specifies WebSocket address to receive live audio stream of the call.   FIXME
     * @return {String} Session ID.
     * @example <caption>[javascript] Usage example</caption>
     * twilio.init('Account Sid', 'Account Token');
     * var sid = twilio.call('+1xxxxxxxxxx', '+972xxxxxxxxx');
     */
    async call(from, to, record, liveAudioStream) {
        utils.assertArgumentNonEmptyString(from, 'from');
        utils.assertArgumentNonEmptyString(to, 'to');

        if (liveAudioStream) {
            // TODO: dispose
            const WebSocket = require('ws');
            const wss = new WebSocket.Server({ port: 3001 });

            wss.on('connection', function connection(ws) {
                ws.on('message', function incoming(message) {
                    console.log('WS message: ', message);
                });

                ws.on('close', function incoming() {
                    console.log('WS close');
                });

                ws.on('error', function incoming(error) {
                    console.log('WS error: ', error);
                });
            });
        }

        var response = await this.httpRequest('POST', `${this._bridgeUrl}/calls/new`,
            {
                accountSid: this._accountSid,
                authToken: this._authToken,
                toNumber: to,
                fromNumber: from,
                record: record,
                liveAudioStreamWSS: 'wss://94d7f388e7a2.ngrok.io'
            });

        this._callSids.push(response.body.sessionId);

        return response.body.sessionId;
    }

    // TODO: add timeout which should be passed to the bridge

    /**
     * @summary Wait for the call to be answered
     * @function waitForAnswer
     * @param {String} sid - Call session ID.
     * @param {Integer=} timeout - Timeout for waiting in milliseconds. Default is 60 seconds.
     */
    async waitForAnswer(sid, timeout = 60 * 1000) {
        utils.assertArgumentNonEmptyString(sid, 'sid');
        utils.assertArgumentTimeout(timeout, 'timeout');

        var response = await this.httpRequest('POST', `${this._bridgeUrl}/calls/${sid}/op/wait/answer`,
            {
                timeout: timeout
            });

        console.log('================================================================= wait for answer');
        console.log(JSON.stringify(response, null,2 ));
        return response;
    }

    /**
     * @summary Wait for the specified speech to be heard over the the line.
     * @function waitForSpeech
     * @param {String} sid - Call session ID.
     * @param {String} text - Text to wait for.
     * @param {String} language - Speech language. See https://www.twilio.com/docs/voice/twiml/say?code-sample=code-say-verb-defaulting-on-alices-voice&code-language=Node.js&code-sdk-version=3.x#attributes-alice
     * @param {(Integer|String)} speechTimeout - Stop listening to the speech after the specified amount of second. 'auto' to stop listening when there is a pause in speech.
     */
    async waitForSpeech(sid, text, language, speechTimeout) {
        utils.assertArgumentNonEmptyString(sid, 'sid');

        if (speechTimeout !== 'auto' && (!Number.isInteger(speechTimeout) || speechTimeout <= 0)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - 'speechTimeout'. Should be 'auto' or a positive integer.");
        }

        var response = await this.httpRequest('POST', `${this._bridgeUrl}/calls/${sid}/op/wait/speech`,
            {
                textToSpeech: text,
                language: language,
                timeout: speechTimeout
            });

        console.log('================================================================= wait for speech');
        console.log(JSON.stringify(response, null,2 ));

        if (!response.body.success) {
            var msg = "The specified speech wasn't received.";
            if (response.body.outcome) {
                msg += ' Received instead: ' + response.body.outcome;
            }
            throw new OxError(errHelper.errorCode.TWILIO_ERROR, msg);
        }
    }

    /**
     * @summary Speak
     * @function speak
     * @param {String} sid - Call session ID.
     * @param {String} text - Text to speak.
     * @param {String} language - Speech language. See https://www.twilio.com/docs/voice/twiml/say?code-sample=code-say-verb-defaulting-on-alices-voice&code-language=Node.js&code-sdk-version=3.x#attributes-alice
     */
    async speak(sid, text, language) {
        utils.assertArgumentNonEmptyString(sid, 'sid');

        var response = await this.httpRequest('POST', `${this._bridgeUrl}/calls/${sid}/op/input/speech`,
            {
                textToSpeech: text,
                language: language
            });

        console.log('================================================================= speak');
        console.log(JSON.stringify(response, null,2 ));
        return response;
    }

    /**
     * @summary Input DTMF tones.
     * @function inputDigits
     * @param {String} sid - Call session ID.
     * @param {String} digits - DTMF tones to send: `1234567890#*`
     */
    async inputDigits(sid, digits) {
        utils.assertArgumentNonEmptyString(sid, 'sid');

        if (!/^[1234567890*#]+$/.test(digits)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - 'digits'. Should contain only '1234567890*#' characters.");
        }

        var response = await this.httpRequest('POST', `${this._bridgeUrl}/calls/${sid}/op/input/digits`,
            {
                digits: digits
            });

        console.log('================================================================= input digits');
        console.log(JSON.stringify(response, null,2 ));
        return response;
    }

    /**
     * @summary Hangup the call
     * @function hangup
     * @param {String} sid - Call session ID.
     */
    async hangup(sid) {
        utils.assertArgumentNonEmptyString(sid, 'sid');
        await this.httpRequest('POST', `${this._bridgeUrl}/calls/${sid}/op/hangup`);
    }

    /**
     * @summary Play an audio file over the line.
     * @function playAudio
     * @param {String} sid - Call session ID.
     * @param {String} url - URL of the audio file. Supported formats: mp3, wav, x-wav, aiff, gsm, ulaw.
     * @example <caption>[javascript] Usage example</caption>
     * twilio.init('Account Sid', 'Account Token');
     * var sid = twilio.call('+1xxxxxxxxxx', '+972xxxxxxxxx');
     * twilio.waitForAnswer(sid);
     * twilio.playAudio(sid, 'https://api.twilio.com/cowbell.mp3');
     */
    async playAudio(sid, url) {
        utils.assertArgumentNonEmptyString(sid, 'sid');
        utils.assertArgumentNonEmptyString(sid, 'url');

        var response = await this.httpRequest('POST', `${this._bridgeUrl}/calls/${sid}/op/input/audio`,
            {
                url : url
            });

        console.log('================================================================= audio');
        console.log(JSON.stringify(response, null,2 ));
        return response;
    }

    async dispose() {
        console.log('================================================================= disposing sid: ' + JSON.stringify(this._callSids));

        var i = this._callSids.length;
        while (i--) {
            await this.httpRequestSilent('POST', `${this._bridgeUrl}/calls/${this._callSids[i]}/op/hangup`);
            this._callSids.splice(i, 1);
        }
    }

    async httpRequest(method, url, body) {
        var opts = {
            url: url,
            method: method,
            form: body,
            json: true,
            timeout: BRIDGE_RESPONSE_TIMEOUT,
            rejectUnauthorized: false
        };

        const requestPromise = util.promisify(request);
        try {
            const response = await requestPromise(opts);
            if ((response.statusCode < 200 || response.statusCode >= 300)) {
                const msg = response.body ? `${response.statusCode} (${response.body.message})` : response.statusCode;
                throw new OxError(errHelper.errorCode.TWILIO_ERROR, 'Error executing bridge command: ' + msg);
            }
            return response;
        } catch (e) {
            if (e instanceof OxError) {
                throw e;
            }
            throw new OxError(errHelper.errorCode.TWILIO_ERROR, "Couldn't connect to the bridge. " + e);
        }
    }

    async httpRequestSilent(method, url) {
        var opts = {
            url: url,
            method: method,
            json: true,
            timeout: BRIDGE_RESPONSE_TIMEOUT,
            rejectUnauthorized: false
        };

        const requestPromise = util.promisify(request);
        try {
            await requestPromise(opts);
        } catch (e) {
            // ignored
        }
    }
}
