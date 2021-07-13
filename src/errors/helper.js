/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Helper module for handling and converting various error types
 */

import OxError from './OxygenError';
const util = require('util');
const path = require('path');

const ERROR_CODES = {
    SCRIPT_ERROR: 'SCRIPT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    ASSERT_ERROR: 'ASSERT_ERROR',
    PDF_ERROR: 'PDF_ERROR',
    VERIFY_ERROR: 'VERIFY_ERROR',
    ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
    FRAME_NOT_FOUND: 'FRAME_NOT_FOUND',
    UNKNOWN_COMMAND_ERROR: 'UNKNOWN_COMMAND_ERROR',
    STALE_ELEMENT_REFERENCE: 'STALE_ELEMENT_REFERENCE',
    ELEMENT_NOT_VISIBLE: 'ELEMENT_NOT_VISIBLE',
    ELEMENT_NOT_INTERACTABLE: 'ELEMENT_NOT_INTERACTABLE',
    LOCATOR_MATCHES_MULTIPLE_ELEMENTS: 'LOCATOR_MATCHES_MULTIPLE_ELEMENTS',
    ELEMENT_STILL_EXISTS: 'ELEMENT_STILL_EXISTS',
    BROWSER_JS_EXECUTE_ERROR: 'BROWSER_JS_EXECUTE_ERROR',
    TIMEOUT: 'TIMEOUT',
    WINDOW_NOT_FOUND: 'WINDOW_NOT_FOUND',
    UNEXPECTED_ALERT_OPEN: 'UNEXPECTED_ALERT_OPEN',
    NO_ALERT_OPEN_ERROR: 'NO_ALERT_OPEN_ERROR',
    MAILINATOR_ERROR: 'MAILINATOR_ERROR',
    APPIUM_UNREACHABLE_ERROR: 'APPIUM_UNREACHABLE_ERROR',
    SELENIUM_UNREACHABLE_ERROR: 'SELENIUM_UNREACHABLE_ERROR',
    CHROMEDRIVER_ERROR: 'CHROMEDRIVER_ERROR',
    WEBDRIVER_ERROR: 'WEBDRIVER_ERROR',
    DB_CONNECTION_ERROR: 'DB_CONNECTION_ERROR',
    DB_QUERY_ERROR: 'DB_QUERY_ERROR',
    SOAP_ERROR: 'SOAP_ERROR',
    NOT_IMPLEMENTED_ERROR: 'NOT_IMPLEMENTED_ERROR',
    SERIAL_PORT_ERROR: 'SERIAL_PORT_ERROR',
    HTTP_ERROR: 'HTTP_ERROR',
    EMAIL_ERROR: 'EMAIL_ERROR',
    MODULE_NOT_INITIALIZED_ERROR: 'MODULE_NOT_INITIALIZED_ERROR',
    DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
    PARAMETERS_ERROR: 'PARAMETERS_ERROR',
    INVALID_CAPABILITIES: 'INVALID_CAPABILITIES',
    BROWSER_CONFIGURATION_ERROR: 'BROWSER_CONFIGURATION_ERROR',
    APPIUM_CONNECTION_ERROR: 'APPIUM_CONNECTION_ERROR',
    APPIUM_SESSION_ERROR: 'APPIUM_SESSION_ERROR',
    SELENIUM_SESSION_ERROR: 'SELENIUM_SESSION_ERROR',
    SELENIUM_SESSION_TIMEOUT: 'SELENIUM_SESSION_TIMEOUT',
    SELENIUM_CONNECTION_ERROR: 'SELENIUM_CONNECTION_ERROR',
    URL_OPEN_ERROR: 'URL_OPEN_ERROR',
    OPTION_NOT_FOUND: 'OPTION_NOT_FOUND',
    ATTRIBUTE_NOT_FOUND: 'ATTRIBUTE_NOT_FOUND',
    ELEMENT_STATE_ERROR: 'ELEMENT_STATE_ERROR',
    MOBILE_CONTEXT_ERROR: 'MOBILE_CONTEXT_ERROR',
    APPLICATION_NOT_FOUND_ERROR: 'APPLICATION_NOT_FOUND_ERROR',
    TWILIO_ERROR: 'TWILIO_ERROR',
    HOOK_ERROR: 'HOOK_ERROR',
    NOT_SUPPORTED: 'NOT_SUPPORTED',
    ASSERT_PASSED: 'ASSERT_PASSED',
    MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
    FILE_BROWSE_ERROR: 'FILE_BROWSE_ERROR',
    CSV_ERROR: 'CSV_ERROR'
};

// Chai to Oxygen error codes mapping
const CHAI_ERROR_CODES = {
    AssertionError: ERROR_CODES.ASSERT_ERROR
};

// General JavaScript error codes mapping
const SCRIPT_ERROR_CODES = {
    TypeError: ERROR_CODES.SCRIPT_ERROR,
    SyntaxError: ERROR_CODES.SCRIPT_ERROR,
    ReferenceError: ERROR_CODES.SCRIPT_ERROR,
};

module.exports = {
    getFailureFromError: function(err) {
        if (!err) {
            return null;
        }
        if (!(err instanceof OxError)) {
            err = this.getOxygenError(err);
        }
        return {
            type: err.type,
            message: err.message,
            data: err.data,
            location: err.location,
            stacktrace: err.stacktrace || null
        };
    },
    getDbErrorMessage: function(err) {
        let message = '';

        if (err && err.message) {
            message += err.message;
        }

        if (
            err &&
            err.odbcErrors &&
            Array.isArray(err.odbcErrors) &&
            err.odbcErrors.length > 0
        ) {
            err.odbcErrors.map((item) => {
                if (
                    item &&
                    item.message
                ) {
                    message += ': ' +item.message;
                }
            });
        }

        return message;
    },
    getOxygenError: function(err, module, cmd, args) {
        // return the error as is if it has been already processed
        if (err instanceof OxError) {
            return err;
        }

        var errType = err.type || err.name || typeof err;
        // handle "Can't call <command> on element with selector <selector> because element wasn't found"
        if (err.message && err.message.includes('because element wasn\'t found')) {
            return new OxError(ERROR_CODES.ELEMENT_NOT_FOUND, err.message, null, true, err);
        }
        // handle "invalid argument: Unsupported locator strategy: -android uiautomator" for mobile.
        // usually due to not using the correct context
        else if (err.message && err.message.includes('Unsupported locator strategy')) {
            let matches = err.message.match(/invalid argument: (.*)/i);
            return new OxError(ERROR_CODES.MOBILE_CONTEXT_ERROR, (matches.length === 2 ? matches[1] : err.message) +
                '. Make sure you are using the correct mobile context. See mob.setNativeContext and mob.setWebViewContext.');
        }
        // handle "invalid selector: Unable to locate an element with the xpath expression"
        // usually due to invalid xpath
        else if (err.message && err.message.includes('Unable to locate an element with the xpath expression')) {
            let matches = err.message.match(/(The string '.*' is not a valid XPath expression.)/i);
            return new OxError(ERROR_CODES.SCRIPT_ERROR, (matches && matches.length === 2 ? matches[1] : err.message));
        }
        // invalid css locator on Chrome/IE. e.g. css=#\:p0
        else if (err.message && err.message.includes('An invalid or illegal selector was specified')) {
            return new OxError(ERROR_CODES.SCRIPT_ERROR, 'An invalid or illegal selector was specified');
        }
        // invalid css locator on Firefox. e.g. css=#\:p0
        else if (err.message && err.message.startsWith('Given css selector expression')) {
            let matches = err.message.match(/(Given css selector expression ".*" is invalid).*/i);
            return new OxError(ERROR_CODES.SCRIPT_ERROR, (matches && matches.length === 2 ? matches[1] : err.message));
        }
        else if (err.message && (err.message.includes('Unable to automate Chrome version') ||
            err.message.includes('No Chromedriver found that can automate'))) {
            return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, extractOriginalError(err.message));
        }
        // handle various types of 'Original error'
        else if (err.message.includes(ORIGINAL_ERROR_MESSAGE)) {
            return new OxError(ERROR_CODES.UNKNOWN_ERROR, extractOriginalError(err.message), util.inspect(err));
        }
        // invalid URL in open command
        else if (err.message && err.message.includes('Invalid URL')) {
            let matches = err.message.match(/( Invalid URL: .*$).*/i);
            return new OxError(ERROR_CODES.SCRIPT_ERROR, (matches && matches.length === 2 ? matches[1] : err.message));
        }
        // usually on mobile Chrome when element is overlapped by another element
        else if (err.message && err.message.startsWith('element click intercepted')) {
            let matches = err.message.match(/element click intercepted: (.*)/i);
            return new OxError(ERROR_CODES.ELEMENT_NOT_VISIBLE, (matches && matches.length === 2 ? matches[1] : err.message));
        }
        // usually because Selenium has killed the session due to exceeding '-timeout' timeout
        else if (err.message && err.message.startsWith('No active session with ID')) {
            return new OxError(ERROR_CODES.SELENIUM_SESSION_ERROR, 'Execution time exceeded the timeout set by Selenium');
        }
        // when driver (IEDriverServer, ChromeDriver, etc) crashes
        else if (err.message === 'java.net.ConnectException: Connection refused: connect') {
            return new OxError(ERROR_CODES.WEBDRIVER_ERROR, 'The underlying WebDriver seems to have crashed: ' + err.message);
        }
        // stale element reference
        else if (err.name && err.name.includes('stale element reference')) {
            return new OxError(ERROR_CODES.STALE_ELEMENT_REFERENCE, err.name + ' ' + err.message);
        }
        else if (err.code && err.code === 'MODULE_NOT_FOUND') {
            return new OxError(ERROR_CODES.MODULE_NOT_FOUND, err.message);
        }
        //  when doing an operation on an element (e.g. click) but the window was already closed
        else if (err.message && err.message.includes('no such window') && err.message.includes('target window already closed') && err.message.includes('web view not found')) {
            return new OxError(ERROR_CODES.WINDOW_NOT_FOUND, err.message);
        }
        // example: The element with selector *** you trying to pass into the execute method wasn't found
        // when element was deleted from DOM
        else if (err.message && err.message.includes('you trying to pass into the execute method wasn\'t found')) {
            return new OxError(ERROR_CODES.ELEMENT_NOT_FOUND,  err.message);
        }
        // when doing an operation on an element reference (e.g. click) but the page was already changed
        else if (err.message && err.message.includes('element not interactable')) {
            return new OxError(ERROR_CODES.ELEMENT_NOT_INTERACTABLE, err.message);
        }
        // invalid selector: java.lang.IllegalArgumentException: Unable to compile selector ...
        else if (
            err.name &&
            err.name === 'invalid selector'
        ) {
            return new OxError(ERROR_CODES.SCRIPT_ERROR, err.message);
        }
        // RequestError: Timeout awaiting 'request' for 310000ms, name: 'TimeoutError'
        else if (err.message && err.message.includes('Timeout awaiting \'request\'')) {
            return new OxError(ERROR_CODES.SELENIUM_SESSION_TIMEOUT ,  err.message);
        }
        else if (err && err.message.includes('socket hang up')) {
            return new OxError(ERROR_CODES.SELENIUM_SESSION_TIMEOUT, err.message);
        }

        // try to resolve Chai error code
        var oxErrorCode = CHAI_ERROR_CODES[errType];
        if (oxErrorCode) {
            // throw non-fatal error if it's a "verify" module or method 
            if (oxErrorCode === ERROR_CODES.ASSERT &&
				(module === 'verify' || cmd.indexOf('verify') === 0)) { // verify.*, *.verify*
                return new OxError(ERROR_CODES.VERIFY, err.message, null, false);
            }
            return new OxError(oxErrorCode, err.message, null, true, err);
        }

        // try to resolve JavaScript error code
        oxErrorCode = SCRIPT_ERROR_CODES[errType];
        if (oxErrorCode) {
            // throw non-fatal error if it's a "verify" module or method 
            if (oxErrorCode === ERROR_CODES.ASSERT &&
				(module === 'verify' || cmd.indexOf('verify') === 0)) { // verify.*, *.verify*
                return new OxError(ERROR_CODES.VERIFY, err.message, null, false);
            }
            return new OxError(oxErrorCode, err.message || null, null, true, err);
        }

        console.log('=== Error Details ===');
        console.log('Type: ' + err.type + ' Name: ' + err.name + ' Code: ' + err.code + ' Msg: ' + err.message);
        console.log(util.inspect(err));

        const errMessage = err.message ? `${errType}: ${err.message}` : `${errType}`;
        return new OxError(ERROR_CODES.UNKNOWN_ERROR, errMessage, util.inspect(err), true, err);
    },
    getSeleniumInitError: function(err) {
        if (err.message) {
            var ieZoomErrorMsg = err.message.match(/(Unexpected error launching Internet Explorer\. Browser zoom level was set to \d+%\. It should be set to \d+%)/gm);
            if (ieZoomErrorMsg) {
                return new OxError(ERROR_CODES.BROWSER_CONFIGURATION_ERROR, ieZoomErrorMsg.toString());
            }

            if (err.message.includes('Unable to create new service: ChromeDriverService')) {
                return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, err.message, null, true, err);
            }

            if (err.message.includes('Unable to create new service:')) {
                return new OxError(ERROR_CODES.SELENIUM_UNREACHABLE_ERROR, err.message, null, true, err);
            }

            var chromeDriverMsg = err.message.match(/(This version of ChromeDriver only supports Chrome version [0-9]*)/gm);
            if (chromeDriverMsg) {
                return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, chromeDriverMsg.toString());
            }
        }

        if (err.message && err.message.includes('cannot find Chrome binary')) {
            return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, 'Cannot find Chrome binary');
        } else if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.message === 'Failed to create session.\nsocket hang up') {
            return new OxError(ERROR_CODES.SELENIUM_UNREACHABLE_ERROR, "Couldn't connect to Selenium server");
        } else if (err.message === 'All minutes for this organization has been exausted' ||
            err.message === '401 Unauthorized' ||
            err.message && err.message.startsWith('Failed to create session.')) {
            return new OxError(ERROR_CODES.SELENIUM_CONNECTION_ERROR, err.message);
        } else if (err.message.includes('Unable to create new service:')) {
            return new OxError(ERROR_CODES.SELENIUM_CONNECTION_ERROR, err.message + '\n\nThis is probably due to missing ChromeDriver/IEDriverServer/GeckoDriver binary.\n');
        }

        console.log('=== Error Details ===');
        console.log('Type: ' + err.type + ' Name: ' + err.name + ' Code: ' + err.code + ' Msg: ' + err.message);
        console.log(util.inspect(err));

        return new OxError(ERROR_CODES.UNKNOWN_ERROR, err.type + ': ' + err.message, util.inspect(err));
    },
    getAppiumInitError: function(err) {
        if (err.message && err.message.includes('cannot find Chrome binary')) {
            return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, 'Cannot find Chrome binary');
        } else if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND' || err.message === 'Failed to create session.\nsocket hang up') {
            return new OxError(ERROR_CODES.APPIUM_UNREACHABLE_ERROR, "Couldn't connect to Appium server");
        } else if (err.message && err.message.includes('Could not find a connected Android device')) {
            return new OxError(ERROR_CODES.DEVICE_NOT_FOUND, 'Could not find a connected Android device');
        } else if (err.message && err.message.includes('Unable to automate Chrome version')) {          // appium <= 1.14
            return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, extractOriginalError(err.message));
        } else if (err.message && err.message.includes('No Chromedriver found that can automate')) {    // appium >= 1.15
            return new OxError(ERROR_CODES.CHROMEDRIVER_ERROR, extractOriginalError(err.message));
        } else if (err.message && err.message.includes('Unable to find an active device or emulator with')) {
            return new OxError(ERROR_CODES.DEVICE_NOT_FOUND, extractOriginalError(err.message));
        } else if (err.message && err.message.includes('is not installed on device')) {
            return new OxError(ERROR_CODES.APPLICATION_NOT_FOUND_ERROR, extractOriginalError(err.message));
        } else if (err.message === 'All minutes for this organization has been exausted' ||
            err.message === '401 Unauthorized') {
            return new OxError(ERROR_CODES.APPIUM_CONNECTION_ERROR, err.message);
        } else if (err.message && (
                err.message.includes('A new session could not be created.') ||
                err.message.includes('Failed to create session.'))) {
            return new OxError(ERROR_CODES.APPIUM_SESSION_ERROR, extractOriginalError(err.message), null, true);
        }

        console.log('=== Error Details ===');
        console.log('Type: ' + err.type + ' Name: ' + err.name + ' Code: ' + err.code + ' Msg: ' + err.message);
        console.log(util.inspect(err));

        return new OxError(ERROR_CODES.UNKNOWN_ERROR, extractOriginalError(err.message), util.inspect(err));
    },
    getAssertError: function(expected, actual) {
        actual = actual.toString().replace(/\n/g, '\\n');
        return new OxError(ERROR_CODES.ASSERT_ERROR, `Expected: "${expected}". Got: "${actual}"`);
    },
    clearRequireStack: function(e) {
        let requireStack = [];

        if (e && e.requireStack) {
            e.requireStack.map((item) => {
                if (item) {
                    if (item.startsWith(this._cwd)) {
                        // path include absolute path to file
                        requireStack.push(item.replace(this._cwd, ''));
                    } else {
                        if (item.includes('build'+path.sep+'runners')) {
                            // ignore
                        } else if (item.includes('OxygenWorker.js') || item.includes('worker.js')) {
                            // ignore
                        } else {
                            // other variants 
                            requireStack.push(item.replace);
                        }
                    }
                }
            });
        }
        e.requireStack = requireStack;
        e.message = e.message.replace(/\nRequire stack(.*)/gs, '');

        return e;
    },
    errorCode: ERROR_CODES
};

const ORIGINAL_ERROR_MESSAGE = 'Original error: ';
const UNKNOWN_ERROR_MESSAGE = 'unknown error: ';

function extractOriginalError(msg) {
    if (!msg) {
        return '';
    }

    var errorIndex1 = msg.indexOf(ORIGINAL_ERROR_MESSAGE);
    if (errorIndex1 === -1) {
        return msg;
    }

    // there could anothe nested "original error"
    var errorIndex2 = msg.indexOf(ORIGINAL_ERROR_MESSAGE, errorIndex1 + ORIGINAL_ERROR_MESSAGE.length);

    msg = msg.substring((errorIndex2 > -1 ? errorIndex2 : errorIndex1)  + ORIGINAL_ERROR_MESSAGE.length);

    // strip 'unknown error:'
    var unknownErrorIndex = msg.indexOf(UNKNOWN_ERROR_MESSAGE);
    if (unknownErrorIndex > -1) {
        return msg.substring(unknownErrorIndex + UNKNOWN_ERROR_MESSAGE.length);
    }

    return msg;
}
