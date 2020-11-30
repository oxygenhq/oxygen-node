/*
 * Copyright (C) 2015-2017 CloudBeat Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/*
 * Test Case Results
 */
module.exports = function () {
    return {
        name: null,
        iterationNum: 1,
        location: null,
        startTime: null,
        endTime: null,
        duration: 0,
        status: null,
        steps: [],    // array of step-result.js
        logs: [],
        har: null,
        failure: null,
        context: null
    };
};
