/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Opens an URL.
 * @description The `open` command waits for the page to load before proceeding.
 * @function waitForOpen
 * @param {String} url - The URL to open; may be relative or absolute.
 * @param {Number=} timeout - Timeout in milliseconds. Default is 60 seconds.
 * @for web
 * @example <caption>[javascript] Usage example</caption>
 * mob.init(caps);//Starts a mobile session and opens app from desired capabilities
 * mob.waitForOpen('www.yourwebsite.com', 145*1000);//Opens an URL.
 */
module.exports = async function(url, timeout) {
    this.helpers.assertArgumentNonEmptyString(url, 'url');
    try {
        await this.driver.waitUntil(async() => {
            try  {
                await this.driver.url(url);
                const urlRV = await this.driver.getUrl();
                return !!urlRV && urlRV.includes(url) && urlRV !== 'http://0.0.0.0:4723/welcome';
            } catch (e) {
                // ignore
            }
        },
        { timeout: (timeout ? timeout : this.waitForTimeout) });

    } catch (e) {
        if (e && e.message.includes('socket hang up')) {
            //try again
            await this.driver.url(url);
        } else {
            if (e && e.message.startsWith('Specified URL')) {
                throw new this.OxError(this.errHelper.errorCode.SCRIPT_ERROR, e.message);
            } else {
                throw e;
            }
        }
    }
};
