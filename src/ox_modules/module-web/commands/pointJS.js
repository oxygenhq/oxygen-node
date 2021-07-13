/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Points the mouse cursor over the specified element.
 * @description This method is similar to `web.point`, however it simulates the action using 
 *              JavaScript instead of using WebDriver's functionality which doesn't work in all cases.
 *              Don't support IE < 9
 * @function pointJS
 * @param {String|Element} locator - An element locator.
 * @param {Number=} timeout - Timeout in milliseconds. Default is 60 seconds.
 */
module.exports = async function(locator, timeout) {
    this.helpers.assertArgumentTimeout(timeout, 'timeout');

    var el = await this.helpers.getElement(locator, false, timeout);
    var isIE = await this.getCapabilities().browserName === 'internet explorer';

    /*global MouseEvent,document,window*/
    var ret = await this.execute(function(e, isIE) {
        var ev;
        if (isIE) {
            // createEvent won't be available in IE < 9 compatibility mode
            if (!document.createEvent) {
                return 'pointJS is not supported on IE with compatibility mode "IE' +
                        document.documentMode + ' ' + document.compatMode + '"';
            }
            ev = document.createEvent('MouseEvent');
            ev.initMouseEvent('mouseover', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        } else {
            ev = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
        }
        e.dispatchEvent(ev);
        return null;
    }, el, isIE);

    if (ret) {
        throw new this.OxError(this.errHelper.errorCode.NOT_SUPPORTED, ret);
    }
    await this.checkWaitForAngular();
};
