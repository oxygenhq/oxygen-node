/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @summary Gets SMS text on Android phone.
 * @description `SMSPopup` application must be installed and running on the device to use this command.
 *              https://github.com/oxygenhq/android-smspopup/releases
 *              Supports only for Android
 * @function smsGetText
 * @param {Number=} timeout - Time in milliseconds to wait for sms popup. Default is 60 seconds.
 * @return {String} - SMS text.
 * @for android
 * @example <caption>[javascript] Usage example</caption>
 * mob.init(caps);//Starts a mobile session and opens app from desired capabilities
 * mob.click("id=sendSmS");// Clicks an element.
 * var a = mob.smsGetText(60000);//Gets SMS text on Android phone.
*/
module.exports = async function(timeout) {
    this.helpers.assertArgumentTimeout(timeout, 'timeout');
    await this.helpers.assertContext(this.helpers.contextList.android);

    var locSms = 'id=android:id/message';
    var locSmsClose = 'id=android:id/button2';

    await this.waitForExist(locSms, timeout);

    var sms = await this.findElement(locSms);

    var text = null;
    if (sms) {
        text = sms.getText();
    }
    // timeout doesn't really matter here since if popup is open close button will always exist
    await this.waitForExist(locSmsClose);
    await this.click(locSmsClose);
    return text;
};
