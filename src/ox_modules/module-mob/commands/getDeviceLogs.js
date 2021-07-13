/*
 * Copyright (C) 2015-present CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @function getDeviceLogs
 * @summary Collects logs from the mobile device.
 * @description Supports only for Android
 * @return {Object[]} A list of logs.
 * @for android, ios, hybrid, web
 * @example <caption>[javascript] Usage example</caption>
 * mob.init(caps); //Starts a mobile session and opens app from desired capabilities
 * mob.getDeviceLogs(); //Collects logs from the mobile device
 */
module.exports = async function () {
	// currently supports only Android logs
    if (this.caps && this.caps.platformName && this.caps.platformName === 'Android') {
        let allLogs = [];
        const contexts = await this.driver.getContexts();
        if (contexts && Array.isArray(contexts) && contexts.length > 0) {
            for (let c in contexts) {
                const context = contexts[c];
                try {
                    await this.driver.switchContext(context);
                } catch (e) {
                    // ignore switch errors, like 
                    // "Failed to get sockets matching: @weblayer_devtools_remote_.*4737\n  (make sure the app has its WebView/WebLayer configured for debugging)
                    continue;
                }
                const types = this.helpers.getLogTypes(context);
                if (types && Array.isArray(types) && types.length > 0) {
                    for (let i in types) {
                        if (types[i] !== 'browser') {
                            const logs = await this.driver.getLogs(types[i]);
                            if (logs && Array.isArray(logs) && logs.length > 0) {
                                allLogs = [
                                    ...allLogs,
                                    ...logs
                                ];
                            }
                        }
                    }
                }
            }
            await this.driver.switchContext(this.appContext);
        }

        return allLogs;
    }

    return null;
};