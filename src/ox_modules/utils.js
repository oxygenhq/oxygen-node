/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const errHelper = require('../errors/helper');
import OxError from '../errors/OxygenError';

const providers = {
    PERFECTO: 'perfecto',
    BROWSERSTACK: 'browserstack',
    SAUCELABS: 'sauce',
    LAMBDATEST: 'lambda',
    TESTINGBOT: 'testingbot'
};

const contextList = {
    android: 'android',
    ios: 'ios',
    hybrid: 'hybrid',
    web: 'web'
};

const isElementNotFound = (el) => {
    let result = false;
    if (
        el.error && (
        el.error.error === 'no such element' ||
        (el.error.message && /* winappdriver win.rightClick */ el.error.message.startsWith('no such element') ||
        el.error.message && /* winappdriver */ el.error.message.startsWith('An element could not be located')))
    ) {
        result = true;
    }
    return result;
};

module.exports = {
    matchPattern: function(val, pattern) {
        if (!val && !pattern) {
            return true;
        }

        var globToRegex = require('glob-to-regexp');
        pattern = pattern.toString().replace(/\s+/g, ' ');

        var regex;
        if (pattern.indexOf('regex:') == 0) {                           // match using a regular-expression
            regex = new RegExp(pattern.substring('regex:'.length), 'g');
            return regex.test(val);
        } else if (pattern.indexOf('regexi:') == 0) {                   // match using a case-insensitive regular-expression
            regex = new RegExp(pattern.substring('regexi:'.length), 'ig');
            return regex.test(val);
        } else if (pattern.indexOf('exact:') == 0 || pattern === '') {  // match a string exactly, verbatim
            return pattern.substring('exact:'.length) === val;
        } else if (pattern.indexOf('glob:') == 0) {                     // match against a case-insensitive "glob" pattern
            regex = globToRegex(pattern.substring('glob:'.length), { flags: 'ig' });
            return regex.test(val);
        } else {                                                        // no prefix same as glob matching
            regex = globToRegex(pattern, { flags: 'ig' });
            return regex.test(val);
        }
    },

    getElement: async function(locator, waitForVisible, timeout) {
        if (timeout) {
            await module.exports.setTimeoutImplicit.call(this, timeout);
        }

        var el;
        if (locator && locator.constructor && locator.constructor.name === 'Element') {
            el = locator;
        } else {
            locator = this.helpers.getWdioLocator(locator);
            el = await this.driver.$(locator);
        }

        const elementNotFound = isElementNotFound(el);
        if (elementNotFound) {
            if (timeout) {
                await module.exports.restoreTimeoutImplicit.call(this);
            }
            throw new OxError(errHelper.errorCode.ELEMENT_NOT_FOUND, `Unable to find element: ${locator}`);
        }

        if (waitForVisible) {
            try {
                await el.waitForDisplayed({ timeout:timeout ? timeout : this.waitForTimeout});
            } catch (e) {
                if (timeout) {
                    await module.exports.restoreTimeoutImplicit.call(this);
                }
                if (e.message && e.message.includes('still not displayed')) {
                    throw new OxError(errHelper.errorCode.ELEMENT_NOT_VISIBLE, `Element not visible: ${locator}`);
                }
                throw e;
            }
        }

        if (timeout) {
            await module.exports.restoreTimeoutImplicit.call(this);
        }

        return el;
    },

    getElements: async function(locator, timeout) {
        if (timeout) {
            await module.exports.setTimeoutImplicit.call(this, timeout);
        }

        let els = [];

        try {
            els = await this.driver.$$(this.helpers.getWdioLocator(locator));
        } catch (e) {
            const elementsNotFound = isElementNotFound(els);
            if (elementsNotFound) {
                // ignore errors
            } else {
                throw e;
            }

        }

        if (timeout) {
            await module.exports.restoreTimeoutImplicit.call(this);
        }

        return els;
    },

    getChildElement: async function(locator, parentElement, waitForVisible, timeout) {
        if (timeout) {
            await module.exports.setTimeoutImplicit.call(this, timeout);
        }

        locator = this.helpers.getWdioLocator(locator);

        if (!(parentElement && parentElement.$)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, 'Invalid argument - parentElement, must be a valid element');
        }

        var el = await parentElement.$(locator);

        const elementNotFound = isElementNotFound(el);
        if (elementNotFound) {
            if (timeout) {
                await module.exports.restoreTimeoutImplicit.call(this);
            }
            throw new OxError(errHelper.errorCode.ELEMENT_NOT_FOUND, `Unable to find element: ${locator}`);
        }

        if (waitForVisible) {
            try {
                await el.waitForDisplayed({ timeout: timeout ? timeout : this.waitForTimeout});
            } catch (e) {
                if (timeout) {
                    await module.exports.restoreTimeoutImplicit.call(this);
                }
                if (e.message && e.message.includes('still not displayed')) {
                    throw new OxError(errHelper.errorCode.ELEMENT_NOT_VISIBLE, `Element not visible: ${locator}`);
                }
                throw e;
            }
        }

        if (timeout) {
            await module.exports.restoreTimeoutImplicit.call(this);
        }

        return el;
    },

    getChildElements: async function(locator, parentElement, timeout) {
        if (timeout) {
            module.exports.setTimeoutImplicit.call(this, timeout);
        }

        locator = this.helpers.getWdioLocator(locator);

        if (!(parentElement && parentElement.$$)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, 'Invalid argument - parentElement, must be a valid element');
        }

        let els = [];
        try {
            els = await parentElement.$$(locator);
        } catch (e) {
            const elementsNotFound = isElementNotFound(els);
            if (elementsNotFound) {
                // ignore errors
            } else {
                throw e;
            }
        }

        if (timeout) {
            await module.exports.restoreTimeoutImplicit.call(this);
        }

        return els;
    },

    setTimeoutImplicit: async function(timeout) {
        if (!this.driver) {
            return;
        }

        if (this.driver.seleniumTimeout && timeout > this.driver.seleniumTimeout * 1000) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, `timeout must be less than ${this.driver.seleniumTimeout * 1000}`);
        }
        if (this.driver.seleniumBrowserTimeout && timeout > this.driver.seleniumBrowserTimeout * 1000) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, `timeout must be less than ${this.driver.seleniumBrowserTimeout * 1000}`);
        }

        let timeouts;

        if (
            this.driver.capabilities &&
            this.driver.capabilities.browserName === 'MicrosoftEdge'
        ) {
            // not supported on Edge
            return;
        } else if (this.driver.getTimeouts) {
            // chrome >= 75
            try {
                if (
                    this.driver.capabilities &&
                    this.driver.capabilities.stopUrl &&
                    this.driver.capabilities.stopUrl.includes('perfectomobile.com')
                ) {
                    //ignore
                } else {
                    timeouts = await this.driver.getTimeouts();
                }
            } catch (e) {
                // fails on perfecto mobile
                console.log('getTimeouts error', e);
            }
        } else if (this.driver.capabilities && this.driver.capabilities.timeouts) {
            // chrome >= 72 && chrome < 75
            timeouts = this.driver.capabilities.timeouts;
        }

        if (timeouts && timeouts.implicit) {
            this._prevImplicitTimeout = timeouts.implicit;
        }
        if (this.driver.setTimeout) {
            if (
                [providers.LAMBDATEST, providers.BROWSERSTACK, providers.PERFECTO].includes(this.driver.provider) &&
                ['MicrosoftEdge', 'msedge', 'Edge', 'Internet Explorer'].includes(this.driver.capabilities.browserName)
            ) {
                // ignore
            } else {
                await this.driver.setTimeout({ 'implicit': timeout });
            }
        }
    },

    restoreTimeoutImplicit: async function() {
        if (this._prevImplicitTimeout && this.driver.setTimeout) {
            await this.driver.setTimeout({ 'implicit': this._prevImplicitTimeout });
        }
    },

    assertArgument: function(arg, name) {
        if (arg === undefined || arg === null) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' is required.");
        }
    },

    assertArgumentString: function(arg, name) {
        if (typeof arg !== 'string') {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be a string.");
        }
    },

    assertArgumentNonEmptyString: function(arg, name) {
        if (!arg || typeof arg !== 'string') {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be a non-empty string.");
        }
    },

    assertArgumentNumber: function(arg, name) {
        if (typeof(arg) !== 'number') {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be a number.");
        }
    },

    assertArgumentNumberNonNegative: function(arg, name) {
        if (typeof(arg) !== 'number' || arg < 0) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be a non-negative number.");
        }
    },

    assertArgumentBool: function(arg, name) {
        if (typeof(arg) != typeof(true)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be true or false.");
        }
    },

    assertArgumentBoolOptional: function(arg, name) {
        if (typeof(arg) !== 'undefined' && typeof(arg) != typeof(true)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be true or false.");
        }
    },

    assertArgumentTimeout: function(arg, name) {
        if (arg && (typeof(arg) !== 'number' || arg < 0)) {
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, "Invalid argument - '" + name + "' should be a non negative number.");
        }
    },

    contextList: contextList,

    assertContext: async function(...alowedContexts) {
        var context = await this.driver.getContext();
        const isWeb = (context && (context.indexOf('WEBVIEW') > -1 || context.indexOf('CHROMIUM') > -1));

        if (isWeb) {
            if (alowedContexts.includes(contextList.web) || alowedContexts.includes(contextList.hybrid)) {
                // ignore, all is ok
            } else {
                throw new OxError(errHelper.errorCode.SCRIPT_ERROR, 'Invalid context');
            }
        } else {
            if (alowedContexts.includes(contextList.android) || alowedContexts.includes(contextList.ios)) {
                // ignore, all is ok
            } else {
                throw new OxError(errHelper.errorCode.SCRIPT_ERROR, 'Invalid context');
            }
        }
    },

    getWdioLocator: function(locator) {
        if (!locator)
            throw new OxError(errHelper.errorCode.SCRIPT_ERROR, 'Invalid argument - locator not specified');
        else if (typeof locator === 'object')
            return locator;
        else if (locator.indexOf('/') === 0)
            return locator;                                 // leave xpath locator as is
        else if (locator.indexOf('id=') === 0) {
            // generate XPath instead of CSS for browser tests, since ID can contain illegal characters
            // and escaping doesn't work reliably or in identical manner in all browser
            if (this.driver.capabilities && this.driver.capabilities.browserName) {
                return `//*[@id="${locator.substr('id='.length)}"]`;
            } else {
                return '#' + locator.substr('id='.length);
            }
        }
        else if (locator.indexOf('name=') === 0)
            return '[name="' + locator.substr('name='.length) + '"]';
        else if (locator.indexOf('link=') === 0)
            return '=' + locator.substr('link='.length);
        else if (locator.indexOf('link-contains=') === 0)
            return '*=' + locator.substr('link='.length);
        else if (locator.indexOf('css=') === 0)
            return locator.substr('css='.length);           // in case of css, just remove css= prefix
        else if (locator.indexOf('tag=') === 0)
            return '<' + locator.substr('tag='.length) + ' />';

        return locator;
    },

    getLogTypes: function(context) {
        if (context === 'NATIVE_APP') {
            return ['logcat', 'bugreport', 'server'];
        } else {
            return ['browser', 'driver'];
        }
    },

    provider: providers,

    determineProvider: function(wdioOpts) {
        if (!wdioOpts || !wdioOpts.capabilities) {
            return null;
        }

        if (wdioOpts.capabilities['perfectoMobile:options'] || (wdioOpts.hostname && wdioOpts.hostname.includes('perfectomobile.com'))) {
            return providers.PERFECTO;
        } else if (wdioOpts.capabilities['browserstack:options']) {
            return providers.BROWSERSTACK;
        } else if (wdioOpts.capabilities['sauce:options']) {
            return providers.SAUCELABS;
        } else if (wdioOpts.hostname.includes('lambdatest')) {
            return providers.LAMBDATEST;
        } else if (wdioOpts.capabilities['testingBot:options']) {
            return providers.TESTINGBOT;
        }

        return null;
    }
};
