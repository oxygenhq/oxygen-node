/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Clicks on an element.
 * @function click
 * @param {String|Element} locator - Element locator.
 * @param {Number=} timeout - Timeout in milliseconds. Default is 60 seconds.
 */
module.exports = async function(locator, timeout) {
    this.helpers.assertArgumentTimeout(timeout, 'timeout');

    let el;
    let err;
    try {
        await this.driver.waitUntil(async() => {
            try {
                el = await this.helpers.getElement(locator, false, timeout);
                return true;
            } catch (e) {
                err = e;
                return false;
            }
        },
        { timeout: (timeout ? timeout : this.waitForTimeout) });
    } catch (e) {
        throw err;
    }

    if (el) {
        await el.click();
    }
};
