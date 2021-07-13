/* eslint-disable no-unused-vars */
/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

'use strict';
/**
 * @name web
 * @description Provides methods for browser automation.
 * @sample **Notes:**  
 *   
 * Commands which operate on elements such as click, assert, waitFor, type, select, and others will automatically wait for a period of time for the element to appear in DOM and become visible. By default this period equals to 60 seconds, but can be changed using the `setTimeout`command.
 *   
 * **String matching patterns:** 
 * 
 *  Commands which expect a string matching pattern in their arguments, support following patterns unless specified otherwise:
 * 
 *  * `regex:PATTERN` - Match using regular expression.
 *  * `regexi:PATTERN` - Match using case-insensitive regular expression.
 *  * `exact:STRING` - Match the string verbatim.
 *  * `glob:PATTERN` - Match using case-insensitive glob pattern. `?` will match any single character except new line \(\n\). `*` will match any sequence \(0 or more\) of characters except new line. Empty     PATTERN will match only other empty strings.
 *  * `PATTERN` - Same as glob matching.  
 *
 * **Locators:** 
 * 
 *  Commands which expect an element locator in their arguments, support following locator types unless specified otherwise:
 * 
 *  * `id=ID` - Locates element by its ID attribute.
 *  * `css=CSS_SELECTOR` - Locates element using a CSS selector.
 *  * `link=TEXT` - Locates link element whose visible text matches the given string.
 *  * `link-contains=TEXT` - Locates link element whose visible text contains the given string.
 *  * `name=NAME` - Locates element by its NAME attribute.
 *  * `tag=NAME` - Locates element by its tag name.
 *  * `/XPATH` - Locates element using an XPath 1.0 expression.
 *  * `(XPATH)[]` - Locates element using an XPath 1.0 expression.
 */

/* eslint-disable quotes */
import { harFromMessages } from 'chrome-har';
import deasync from 'deasync';
import URL from 'url';
import * as wdio from 'webdriverio';
import WebDriverModule from '../core/WebDriverModule';
import { defer } from 'when';
import modUtils from './utils';
import errHelper from '../errors/helper';
import OxError from '../errors/OxygenError';
import util from 'util';
import SauceLabs from 'saucelabs';
import lambdaRestClient from '@lambdatest/node-rest-client';
import TestingBot from 'testingbot-api';
import { execSync } from 'child_process';
import perfectoReporting from 'perfecto-reporting';
import request from 'request';
import mergeImages from '../lib/img-merge';
import errorHelper from '../errors/helper';

const MODULE_NAME = 'web';
const DEFAULT_SELENIUM_URL = 'http://localhost:4444/wd/hub';
const DEFAULT_BROWSER_NAME = 'chrome';
const NO_SCREENSHOT_COMMANDS = ['init', 'assertAlert'];
const ACTION_COMMANDS = ['open', 'click'];
const DEFAULT_WAIT_TIMEOUT = 60 * 1000;            // default 60s wait timeout

export default class WebModule extends WebDriverModule {
    constructor(options, context, rs, logger, modules, services) {
        super(options, context, rs, logger, modules, services);
        this.transactions = {};                      // transaction->har dictionary
        this.lastNavigationStartTime = null;
        this.helpers = {};
        this._loadHelperFunctions();
        // support backward compatibility (some module commands might refer to this.OxError and this.errHelper)
        this.OxError = OxError;
        this.errHelper = errHelper;
        // holds element operation timeout value
        this.waitForTimeout = DEFAULT_WAIT_TIMEOUT;
    }

    get name() {
        return MODULE_NAME;
    }

    /**
     * @function getDriver
     * @summary Returns the underlying WDIO driver.
     * @return {Object} WDIO driver.
     */
    getDriver() {
        return super.getDriver();
    }

    /**
     * @function getCapabilities
     * @summary Returns currently defined capabilities.
     * @return {Object} Current capabilities object.
     */
    getCapabilities() {
        return this.caps || super.getCapabilities();
    }

    /**
     * @function init
     * @summary Initializes new Selenium session.
     * @description 
     *  Record HAR only for chrome
     *  Collect browser logs only for chrome
     *  Don't run maximizeWindow and setTimeout commands for MicrosoftEdge
     * @param {String=} caps - Desired capabilities. If not specified capabilities will be taken from suite definition.
     * @param {String=} seleniumUrl - Remote server URL (default: http://localhost:4444/wd/hub).
     */
    async init(caps, seleniumUrl) {
        if (this.isInitialized) {
            return;
        }

        if (!seleniumUrl) {
            seleniumUrl = this.options.seleniumUrl || DEFAULT_SELENIUM_URL;
        }

        // take capabilities either from init method argument or from context parameters passed in the constructor
        // merge capabilities from context and from init function argument, give preference to context-passed capabilities
        this.caps = {};
        if (this.ctx.caps) {
            this.caps = { ...this.ctx.caps };
        }
        if (caps) {
            this.caps = { ...this.caps, ...caps };
        }

        // populate browserName caps from options. FIXME: why is this even needed?
        if (!this.caps.browserName) {
            this.caps.browserName = this.options.browserName || DEFAULT_BROWSER_NAME;
        }
        // FIXME: shall we throw an exception if browserName is not specified, neither in caps nor in options?!
        if (!this.caps.browserName) {
            throw new OxError(errHelper.errorCode.INVALID_CAPABILITIES,
                'Failed to initialize `web` module - browserName must be specified.');
        }

        // adjust browserName-s
        if (this.caps.browserName.toLowerCase() === 'ie') {
            // IE is specified as 'ie' through the command line and possibly suites
            // but selenium standalone server expects 'internet explorer'
            this.caps.browserName = 'internet explorer';
        } else if (this.caps['lambda:options']) {
            // lambdatest expects original case names
        } else if (this.caps.browserName !== 'MicrosoftEdge') {
            // selenium standalone server expects all browserNames to be lowercase
            // except "MicrosoftEdge"
            this.caps.browserName = this.caps.browserName.toLowerCase();
        }

        // adjust capabilities to enable collecting browser and performance stats in Chrome 
        if (this.options.recordHAR && this.caps.browserName === 'chrome') {
            this.caps['goog:loggingPrefs'] = {     // for ChromeDriver >= 75
                browser: 'ALL',
                performance: 'ALL'
            };
            /*
            // specifying this leads Chrome 77+ to refuse loading
            this.caps.loggingPrefs = {             // for ChromeDriver < 75
                browser: 'ALL',
                performance: 'ALL'
            };
            this.caps.chromeOptions = {
                perfLoggingPrefs: {
                    enableNetwork: true,
                    enablePage: false
                }
            };
            */
        }

        // populate WDIO options
        const url = URL.parse(seleniumUrl || DEFAULT_SELENIUM_URL);
        const protocol = url.protocol.replace(/:$/, '');
        const host = url.hostname;
        const port = parseInt(url.port || (protocol === 'https' ? 443 : 80));
        const path = url.pathname;

        // auth is needed mostly for cloud providers such as LambdaTest
        if (url.auth) {
            const auth = url.auth.split(':');
            this.options.wdioOpts = {
                user: auth[0],
                key: auth[1]
            };
        }

        const wdioOpts = {
            ...this.options.wdioOpts || {},
            protocol: protocol,
            hostname: host,
            port: port,
            path: path,
            capabilities: this.caps,
            logLevel: 'silent',
            runner: 'repl',
            waitforTimeout: 5000, // increase the default 3000
            connectionRetryTimeout: 310*1000,
            connectionRetryCount: 1
        };

        let initError = null;
        const _this = this;

        let provider = modUtils.determineProvider(wdioOpts);

        if (provider === modUtils.provider.PERFECTO) {
            wdioOpts.path = '/nexperience/perfectomobile/wd/hub';
            wdioOpts.port = 80;
            wdioOpts.protocol = 'http';
            wdioOpts.openDeviceTimeout = 15;
        }

        let name = 'name';
        if (wdioOpts.capabilities['perfectoMobile:options'] && wdioOpts.capabilities['perfectoMobile:options']['name']) {
            name = wdioOpts.capabilities['perfectoMobile:options']['name'];
            delete wdioOpts.capabilities['perfectoMobile:options'];
        }
        this.wdioOpts = wdioOpts;

        try {
            this.driver = await wdio.remote(wdioOpts);
            this.driver.provider = provider;

            if (this.options.seleniumBrowserTimeout) {
                this.driver.seleniumBrowserTimeout = this.options.seleniumBrowserTimeout;
            }

            if (this.options.seleniumTimeout) {
                this.driver.seleniumTimeout = this.options.seleniumTimeout;
            }

            if (provider === modUtils.provider.PERFECTO) {
                const perfectoExecutionContext = new perfectoReporting.Perfecto.PerfectoExecutionContext({
                    webdriver: {
                        executeScript: (command, params) => {
                            this.driver.execute(command, params);
                        }
                    }
                });
                this.reportingClient = new perfectoReporting.Perfecto.PerfectoReportingClient(perfectoExecutionContext);
                this.reportingClient.testStart(name);

                // avoid request abort
                deasync.sleep(10*1000);
            }
        }
        catch (e) {
            throw errHelper.getSeleniumInitError(e);
        }

        // reset browser logs if auto collect logs option is enabled
        if (this.options.collectBrowserLogs && this.caps.browserName === 'chrome') {
            try {
                // simply call this to clear the previous logs and start the test with the clean logs
                await this.getBrowserLogs();
            } catch (e) {
                this.logger.error('Cannot retrieve browser logs.', e);
            }
        }

        try {
            if (
                [modUtils.provider.LAMBDATEST, modUtils.provider.BROWSERSTACK, modUtils.provider.PERFECTO].includes(this.driver.provider) &&
                ['MicrosoftEdge', 'msedge', 'Edge', 'Internet Explorer'].includes(this.driver.capabilities.browserName)
            ) {
                // ignore
            } else {
                // maximize browser window
                await this.driver.maximizeWindow();
                // set initial Timeout
                await this.driver.setTimeout({ 'implicit': this.waitForTimeout });
            }

        } catch (err) {
            throw new OxError(errHelper.errorCode.UNKNOWN_ERROR, err.message, util.inspect(err));
        }
        super.init(this.driver);
    }

    /**
     * @function dispose
     * @summary Ends the current session.
     * @param {String=} status - Test status, either `passed` or `failed`.
     */
    async dispose(status) {
        this._whenWebModuleDispose = defer();

        if (!status) {
            status = 'passed';

            if (this.rs.steps && Array.isArray(this.rs.steps) && this.rs.steps.length > 0) {
                const failedFinded = this.rs.steps.find((item) => item.status === 'failed');
                if (failedFinded) {
                    status = 'failed';
                }
            }
        }

        if (this.driver && this.isInitialized) {
            try {
                status = status.toUpperCase();

                if (this.driver.provider === modUtils.provider.SAUCELABS) {
                    const username = this.wdioOpts.capabilities['sauce:options']['username'];
                    const accessKey = this.wdioOpts.capabilities['sauce:options']['accessKey'];
                    const passed = status === 'PASSED';
                    const id = this.driver.sessionId;
                    const body = "{\"passed\":"+passed+"}";

                    const myAccount = new SauceLabs({ user: username, key: accessKey});
                    await myAccount.updateJob(username, id, body);
                    await myAccount.stopJob(username, id);
                } else if (this.driver.provider === modUtils.provider.LAMBDATEST) {
                    const lambdaCredentials = {
                        username: this.wdioOpts.user,
                        accessKey: this.wdioOpts.key
                    };

                    const sessionId = this.driver.sessionId;

                    const lambdaAutomationClient = lambdaRestClient.AutomationClient(
                        lambdaCredentials
                    );

                    const requestBody = {
                        status_ind: status === 'PASSED' ? 'passed' : 'failed'
                    };

                    let done = false;

                    lambdaAutomationClient.updateSessionById(sessionId, requestBody, () => {
                        done = true;
                    });

                    deasync.loopWhile(() => !done);
                } else if (this.driver.provider === modUtils.provider.TESTINGBOT) {
                    const sessionId = this.driver.sessionId;
                    const tb = new TestingBot({
                        api_key: this.wdioOpts.user,
                        api_secret: this.wdioOpts.key
                    });
                    let done = false;
                    const testData = { "test[success]" : status === 'PASSED' ? "1" : "0" };
                    tb.updateTest(testData, sessionId, function(error, testDetails) {
                        done = true;
                    });
                    deasync.loopWhile(() => !done);
                } else if (this.driver.provider === modUtils.provider.PERFECTO) {
                    this.reportingClient.testStop({
                        status: status === 'PASSED' ?
                                    perfectoReporting.Constants.results.passed :
                                    perfectoReporting.Constants.results.failed
                    });
                    // avoid request abort
                    deasync.sleep(10*1000);
                } else if (this.driver.provider === modUtils.provider.BROWSERSTACK) {
                    const requestBody = {
                        status: status === 'PASSED' ? 'passed' : 'failed'
                    };

                    var result = null;
                    var options = {
                        url: `https://api.browserstack.com/automate/sessions/${this.driver.sessionId}.json`,
                        method: 'PUT',
                        json: true,
                        rejectUnauthorized: false,
                        body: requestBody,
                        'auth': {
                            'user': this.wdioOpts.user,
                            'pass': this.wdioOpts.key,
                            'sendImmediately': false
                        },
                    };

                    request(options, (err, res, body) => { result = err || res; });
                    deasync.loopWhile(() => !result);
                    await this.deleteSession();
                }

                if (this.driver.provider === null && ['PASSED','FAILED'].includes(status)) {
                    await this.closeBrowserWindows(status);
                } else {
                    // canceled or other status
                    this.disposeContinue();
                }
            } catch (e) {
                this.logger.warn('Error disposing driver: ', e);    // ignore any errors at disposal stage
            }
        } else {
            this.disposeContinue();
        }

        return this._whenWebModuleDispose.promise;
    }

    async deleteSession() {
        try {
            if (this.driver && this.driver.deleteSession) {
                if (this.seleniumSessionTimeout) {
                    // ignore
                    // deleteSession will take 5 min to call
                } else {
                    await this.driver.deleteSession();
                }
            }
        } catch (e) {
            this.logger.error('deleteSession error', e);
        }
    }

    async closeBrowserWindows(status) {
        if (status && 'FAILED' === status.toUpperCase() && this.options && this.options.seleniumPid) {
            this.disposeContinue(status);
        } else {
            try {
                await this.deleteSession();
            } catch (e) {
                this.logger.warn('Failed to close browser windows:', e);
            }
            this.disposeContinue();
        }
    }

    disposeContinue(status) {
        this.driver = null;
        this.lastNavigationStartTime = null;
        super.dispose();

        // cleanup chromedriver's only when running from within the IDE and test did not fail
        if (this.options && this.options.seleniumPid && (!status || 'FAILED' !== status.toUpperCase())) {
            try {
                if (process.platform === 'win32') {
                    execSync('taskkill /IM chromedriver.exe /F', { stdio: ['ignore', 'ignore', 'ignore'] });
                } else {
                    let pgrepResult = execSync("pgrep -d' ' chromedriver");
                    if (pgrepResult && pgrepResult.toString) {
                        pgrepResult = pgrepResult.toString();
                        if (pgrepResult) {
                            execSync('kill -9 ' + pgrepResult, { stdio: ['ignore', 'ignore', 'ignore'] });
                        }
                    }
                }
            } catch (e) {
                // ignore errors
            }
        }

        // cleanup edgedriver's only when running from within the IDE and test did not fail
        if (this.options && this.options.seleniumPid && (!status || 'FAILED' !== status.toUpperCase())) {
            try {
                if (process.platform === 'win32') {
                    // ignore for now
                } else {
                    let pgrepResult = execSync("pgrep -d' ' msedgedriver");
                    if (pgrepResult && pgrepResult.toString) {
                        pgrepResult = pgrepResult.toString();
                        if (pgrepResult) {
                            execSync('kill -9 ' + pgrepResult, { stdio: ['ignore', 'ignore', 'ignore'] });
                        }
                    }
                }
            } catch (e) {
                // ignore errors
            }
        }

        this._whenWebModuleDispose.resolve(null);
    }

    _iterationStart() {
        // clear transaction name saved in previous iteration if any
        global._lastTransactionName = null;
    }

    async _iterationEnd(error) {
        if (error && error.type === errorHelper.errorCode.SELENIUM_SESSION_TIMEOUT) {
            this.seleniumSessionTimeout = true;
            return;
        } else {
            this.seleniumSessionTimeout = false;
        }

        if (!this.isInitialized) {
            return;
        }
        // collect browser logs for this session
        if (this.options.collectBrowserLogs === true && this.caps.browserName === 'chrome') {
            try {
                const logs = await this.getBrowserLogs();
                if (logs && Array.isArray(logs)) {
                    for (var log of logs) {
                        this.rs.logs.push(this._adjustBrowserLog(log));
                    }
                }
            } catch (e) {
                // ignore errors
                this.logger.error('Cannot retrieve browser logs.', e);
            }
        }
        // TODO: should clear transactions to avoid duplicate names across iterations
        // also should throw on duplicate names.
        if (this.options.recordHAR && this.caps.browserName === 'chrome') {
            // there might be no transactions set if test fails before web.transaction command
            if (global._lastTransactionName) {
                this.transactions[global._lastTransactionName] = await this._getHAR();
            }
        }

        this.rs.har = this.transactions;
    }

    _isAction(name) {
        return ACTION_COMMANDS.includes(name);
    }

    _takeScreenshotSilent(name) {
        if (!NO_SCREENSHOT_COMMANDS.includes(name)) {
            let error;
            try {
                if (
                    this.driver &&
                    this.driver.takeScreenshot
                ) {
                    let retval;
                    this.driver.call(() => {
                        return new Promise((resolve, reject) => {
                            const waitUntilRetVal = this.driver.waitUntil(async() => {
                                try {
                                    let images = [];

                                    // collect all (screenshot and title) images
                                    const handles = await this.driver.getWindowHandles();
                                    if (
                                        handles &&
                                        Array.isArray(handles) &&
                                        handles.length > 0
                                    ) {
                                        for (const handle of handles) {
                                            await this.driver.switchToWindow(handle);
                                            const image = await this.driver.takeScreenshot();
                                            const title = await this.driver.getTitle();

                                            if (title) {
                                                const textToImage = require('text-to-image');
                                                let titleImage = await textToImage.generate(title, { debug: false, fontFamily: 'Arial' });
                                                if (titleImage && typeof titleImage === 'string') {
                                                    titleImage = titleImage.replace('data:image/png;base64,', '');
                                                    images.push(titleImage);
                                                }
                                            }

                                            images.push(image);
                                        }
                                    }

                                    // merge all images into one
                                    const mergedImage = await mergeImages(images, { direction: true });
                                    if (mergedImage && typeof mergedImage === 'string') {
                                        retval = mergedImage.replace('data:image/jpeg;base64,', '');
                                    }

                                    return true;
                                } catch (e) {
                                    error = e;
                                    return false;
                                }
                            },
                            { timeout: 30*1000 });

                            if (waitUntilRetVal && waitUntilRetVal.then) {
                                waitUntilRetVal.then(() => {
                                    resolve();
                                }).catch((err) => {
                                    reject(err);
                                });
                            } else {
                                resolve();
                            }
                        });
                    });

                    if (error) {
                        this.logger.error('Cannot get screenshot', error);
                    }

                    return retval;
                }
            } catch (e) {
                this.logger.error('Cannot get screenshot', e);
                if (error) {
                    this.logger.error('Cannot get screenshot inner error', error);
                }
                // ignore
            }
        }
    }

    _adjustBrowserLog(log) {
        if (!log || typeof log !== 'object') {
            return null;
        }
        // TODO: convert log.timestamp from the browser time zone to the local one (so we can later correlate between steps and logs)
        return {
            time: log.timestamp,
            msg: log.message,
            // convert SEVERE log level to ERROR
            level: log.level === 'SEVERE' ? 'ERROR' : log.level,
            src: 'browser'
        };
    }

    /*
     * FIXME: There is a bug with IE. See the comment within function body.
     *
     *  domContentLoaded (aka First Visual Time)- Represents the difference between domContentLoadedEventStart and navigationStart.
     *  load (aka Full Load Time)               - Represents the difference between loadEventStart and navigationStart.
     *
     * The processing model:
     *
     *  1. navigationStart              - The browser has requested the document.
     *  2. ...                          - Not relevant to us. See http://www.w3.org/TR/navigation-timing/#process for more information.
     *  3. domLoading                   - The browser starts parsing the document.
     *  4. domInteractive               - The browser has finished parsing the document and the user can interact with the page.
     *  5. domContentLoadedEventStart   - The document has been completely loaded and parsed and deferred scripts, if any, have executed. 
     *                                    Async scripts, if any, might or might not have executed.
     *                                    Stylesheets[1], images, and subframes might or might not have finished loading.
     *                                      [1] - Stylesheets /usually/ defer this event! - http://molily.de/weblog/domcontentloaded
     *  6. domContentLoadedEventEnd     - The DOMContentLoaded event callback, if any, finished executing. E.g.
     *                                      document.addEventListener("DOMContentLoaded", function(event) {
     *                                          console.log("DOM fully loaded and parsed");
     *                                      });
     *  7. domComplete                  - The DOM tree is completely built. Async scripts, if any, have executed.
     *  8. loadEventStart               - The browser have finished loading all the resources like images, swf, etc.
     *  9. loadEventEnd                 - The load event callback, if any, finished executing.
     */
    _getStats(commandName) {
        if (this.options.fetchStats && this.isInitialized && this._isAction(commandName)) {
            var navigationStart;
            var domContentLoaded = 0;
            var load = 0;
            var samePage = false;

            // TODO: handle following situation:
            // if navigateStart equals to the one we got from previous attempt (we need to save it)
            // it means we are still on the same page and don't need to record load/domContentLoaded times
            try {
                this.driver.call(() => {
                    return new Promise((resolve, reject) => {
                        let lastError = false;
                        const waitUntilRetVal = this.driver.waitUntil(async() => {
                            try {
                                /*global window*/
                                var timings = await this.driver.execute(function() {
                                    return {
                                        navigationStart: window.performance.timing.navigationStart,
                                        domContentLoadedEventStart: window.performance.timing.domContentLoadedEventStart,
                                        loadEventStart: window.performance.timing.loadEventStart
                                    };
                                });
                                lastError = false;

                                if (timings.domContentLoadedEventStart > 0 && timings.loadEventStart > 0) {
                                    samePage = this.lastNavigationStartTime && this.lastNavigationStartTime == timings.navigationStart;
                                    navigationStart = this.lastNavigationStartTime = timings.navigationStart;
                                    var domContentLoadedEventStart = timings.domContentLoadedEventStart;
                                    var loadEventStart = timings.loadEventStart;

                                    domContentLoaded = domContentLoadedEventStart - navigationStart;
                                    load = loadEventStart - navigationStart;

                                    return domContentLoadedEventStart > 0 && loadEventStart > 0;
                                } else {
                                    return false;
                                }
                            } catch (executeError) {
                                // collect error inside driver.execute or driver.waitUntil
                                lastError = executeError;
                            }
                        },
                        { timeout: 30*1000 });

                        if (waitUntilRetVal && waitUntilRetVal.then) {
                            waitUntilRetVal.then(() => {
                                if (lastError) {
                                    // print error from driver.execute or driver.waitUntil
                                    console.log(lastError);
                                }
                                resolve();
                            }).catch((err) => {
                                if (lastError) {
                                    // print error from driver.execute or driver.waitUntil
                                    console.log(lastError);
                                }
                                reject(err);
                            });
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (e) {
                return {};
                // couldn't get timings.
            }

            this.lastNavigationStartTime = navigationStart;

            return samePage ? {} : { DomContentLoadedEvent: domContentLoaded, LoadEvent: load };
        }

        return {};
    }

    /**
     * @summary Opens new transaction.
     * @description The transaction will persist till a new one is opened. Transaction names must be
     *              unique.
     * @function transaction
     * @param {String} name - The transaction name.
     */
    async transaction(name) {
        if (global._lastTransactionName) {
            this.transactions[global._lastTransactionName] = null;

            if (this.options.recordHAR && this.isInitialized && this.caps.browserName === 'chrome') {
                this.transactions[global._lastTransactionName] = await this._getHAR();
            }
        }

        if (typeof this.transactions[name] !== 'undefined') {
            const counter = Object.keys(this.transactions).filter((item) => item.startsWith(name)).length + 1;
            global._lastTransactionName = name+'(#'+counter+')';
        } else {
            global._lastTransactionName = name;
        }
    }

    _loadHelperFunctions() {
        this.helpers.getWdioLocator = modUtils.getWdioLocator;
        this.helpers.matchPattern = modUtils.matchPattern;
        this.helpers.getElement = modUtils.getElement;
        this.helpers.getElements = modUtils.getElements;
        this.helpers.getChildElement = modUtils.getChildElement;
        this.helpers.getChildElements = modUtils.getChildElements;
        this.helpers.setTimeoutImplicit = modUtils.setTimeoutImplicit;
        this.helpers.restoreTimeoutImplicit = modUtils.restoreTimeoutImplicit;
        this.helpers.assertArgument = modUtils.assertArgument;
        this.helpers.assertArgumentNonEmptyString = modUtils.assertArgumentNonEmptyString;
        this.helpers.assertArgumentNumber = modUtils.assertArgumentNumber;
        this.helpers.assertArgumentNumberNonNegative = modUtils.assertArgumentNumberNonNegative;
        this.helpers.assertArgumentBool = modUtils.assertArgumentBool;
        this.helpers.assertArgumentBoolOptional = modUtils.assertArgumentBoolOptional;
        this.helpers.assertArgumentTimeout = modUtils.assertArgumentTimeout;
        this.helpers.assertArgumentString = modUtils.assertArgumentString;
    }

    async _getHAR() {
        try {
            const types = await this.driver.getLogTypes();

            if (types.includes('performance')) {
                const logs = await this.driver.getLogs('performance');

                // in one instance, logs was not iterable for some reason - hence the following check:
                if (!logs || typeof logs[Symbol.iterator] !== 'function') {
                    this.logger.error('getHAR: logs not iterable: ' + JSON.stringify(logs));
                    return null;
                }

                const events = [];
                for (let log of logs) {
                    const msgObj = JSON.parse(log.message);   // returned as string
                    events.push(msgObj.message);
                }

                const har = harFromMessages(events);
                return JSON.stringify(har);
            } else {
                return null;
            }
        } catch (e) {
            this.logger.error('Unable to fetch HAR: ' + e.toString());
            return null;
        }
    }

    async checkWaitForAngular() {
        if (this.autoWaitForAngular) {
            await this.waitForAngular(this.autoWaitForAngularRootSelector, this.autoWaitForAngularTimeout);
        }
    }
}

