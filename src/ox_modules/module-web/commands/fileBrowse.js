/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Uploads a local file
 * @description Can crush driver
 * @function fileBrowse
 * @param {String|Element} locator - Locator for a `input type=file` element.
 * @param {String} filepath - Path to a local file.
 * @param {Number=} timeout - Timeout in milliseconds. Default is 60 seconds.
 * @example <caption>[javascript] Usage example</caption>
 * web.init();//Opens browser session.
 * web.open("www.yourwebsite.com");// Opens a website.
 * web.fileBrowse("id=ProfilePicture","C:\\picture.jpg");//Uploads a file to an element.
 */

const fs = require('fs');
const path = require('path');

module.exports = async function(locator, filepath, timeout) {
    this.helpers.assertArgumentNonEmptyString(filepath, 'filepath');
    this.helpers.assertArgumentTimeout(timeout, 'timeout');

    const el = await this.helpers.getElement(locator, false, timeout);
    try {
        // make an asynchronous call using archiver 3rd party library supporting promises
        const remoteFilePath = await this.driver.call(() => {
            return new Promise( (resolve, reject) => {
                let zipData = [];
                // require in top level produce Error : Cannot read property 'objectMode' of undefined
                const archiver = require('archiver');
                const source = fs.createReadStream(filepath);
                const name = path.basename(filepath);

                archiver('zip')
                    .on('error', (err) => reject(err))
                    .on('data', (data) => {
                        zipData.push(data);
                    })
                    .on('end', () => {
                        this.driver.file(Buffer.concat(zipData).toString('base64')).then(resolve, reject);
                    })
                    .append(source, { name: name })
                    .finalize((err) => {
                        if (err) {
                            reject(err);
                        }
                    });
            });
        });

        try {
            // set local temp file path into file input
            await el.setValue(remoteFilePath);
        } catch (e) {
            if (e.name === 'invalid element state') {
                throw new this.OxError(this.errHelper.errorCode.ELEMENT_STATE_ERROR, e.message);
            }
            throw e;
        }
    } catch (e) {
        throw new this.OxError(this.errHelper.errorCode.FILE_BROWSE_ERROR, e.message);
    }
};
