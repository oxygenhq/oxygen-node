/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Gets the source of the currently active window which displays `text/xml` page.
 * @description Support only chrome and ie
 * @function getXMLPageSource
 * @return {String} The XML page source.
 * @example <caption>[javascript] Usage example</caption>
 * web.init();//Opens browser session.
 * web.open("www.yourwebsite.com");// Opens a website.
 * var src = web.getXMLPageSource();//Gets the source of currently active window which displays `text/xml` page.
 */
module.exports = async function() {
    var browser = this.caps.browserName;
    switch (browser) {
        case 'chrome':
        case 'MicrosoftEdge': {
            const retval = await this.driver.execute(() => {
                // eslint-disable-next-line no-undef
                var xmlEl = document.getElementById('webkit-xml-viewer-source-xml');
                return xmlEl ? xmlEl.innerHTML : null;
            });
            return retval;
        }
        case 'ie':
            var src = await this.driver.getPageSource();
            src = src.replace(/<head>(.|\n)*?<\/head>/g, '');
            src = src.replace(/<a\s*.*?>&lt;.*?<\/a>/g, '');
            src = src.replace(/<div\s*.*?>.*?<\/div>/g, '');
            src = src.replace(/<style\s*.*?>.*?<\/style>/g, '');
            src = src.replace(/>\n/g, '>');
            return src.replace(/<span\s*.*?>.*?<span\s*.*?>.*?<\/span>.*?<\/span>/g, '');
        default:
            throw new this.OxError(this.errHelper.errorCode.SCRIPT_ERROR, 'This command is not supported on ' + browser + ' yet.');
    }
};
