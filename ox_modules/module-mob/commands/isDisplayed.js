/**
 * @summary Checks if element is visible on the screen.
 * @function isDisplayed
 * @param {String} locator - Element locator.
 * @return {Boolean} - true if the element is visible.
*/
module.exports = function(locator) {
    this._helpers._assertLocator(locator);
    
    // when locator is an element object
    if (typeof locator === 'object' && locator.click) {
        return locator.isVisible();
    }
    // when locator is string
    locator = this._helpers.getWdioLocator(locator);
    return this._driver.isVisible(locator);
};

