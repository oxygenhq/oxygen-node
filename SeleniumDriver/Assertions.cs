﻿using OpenQA.Selenium;
using OpenQA.Selenium.Support.UI;
using System;
using System.Linq;

namespace CloudBeat.Oxygen
{
    public partial class SeleniumDriver
    {
        // Selenese non-compliant, custom, assertion
        public void SeCmdAssertEqual(string target, string value)
        {
            if (target != value)
                throw new SeAssertionException();
        }

        public void SeCmdWaitForVisible(string target, string value)
        {
            bool elementPresent = false;
            UnhandledAlertException alert = null;

            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                    {
                        try
                        {
                            var el = this.FindElement(ResolveLocator(target));
                            elementPresent = true;
                            if (el.Displayed)
                                return true;
                        }
                        catch (NoSuchElementException)
                        {
                            elementPresent = false;
                        }
                        catch (UnhandledAlertException uae)
                        {
                            alert = uae;
                            return true;
                        }
                        return false;
                    });

                    if (alert != null)
                        throw alert;
                    return;
                }
                catch (StaleElementReferenceException) { }
                catch (WebDriverTimeoutException)
                {
                    if (elementPresent)
                        throw new SeElementNotVisibleException();
                    else
                        throw new SeElementNotFoundException();
                }
            }

            throw new StaleElementReferenceException();
        }

        public void SeCmdWaitForAllLinks(string target, string value)
        {
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                    {
                        var links = this.FindElements(By.TagName("a"));

                        string ids = "";
                        foreach (var link in links)
                        {
                            string id = link.GetAttribute("id");
                            ids += id + ",";
                        }

                        if (ids.Length > 1)
                            ids = ids.TrimEnd(',');

                        return MatchPattern(ids, target);
                    });

                    return;
                }
                catch (StaleElementReferenceException) { }
                catch (WebDriverTimeoutException)
                {
                    throw new SeWaitForException();
                }
            }

            throw new StaleElementReferenceException();
        }

        public void SeCmdWaitForElementPresent(string target, string value)
        {
            UnhandledAlertException alert = null;
            try
            {
                new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                {
                    try
                    {
                        var el = this.FindElement(ResolveLocator(target));
                        return el != null;
                    }
                    catch (NoSuchElementException)
                    {

                    }
                    catch (UnhandledAlertException uae)
                    {
                        alert = uae;
                        return true;
                    }

                    return false;
                });

                if (alert != null)
                    throw alert;
                return;
            }
            catch (WebDriverTimeoutException)
            {
                throw new SeElementNotFoundException();
            }
        }

        public void SeCmdWaitForText(string target, string value)
        {
            string valCleaned = CollapseWhitespace(value);
            bool elementPresent = false;
            UnhandledAlertException alert = null;

            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                    {
                        try
                        {
                            var el = this.FindElement(ResolveLocator(target));
                            elementPresent = true;
                            return MatchPattern(el.Text, valCleaned);
                        }
                        catch (NoSuchElementException) 
                        {
                            elementPresent = false;
                        }
                        catch (UnhandledAlertException uae)
                        {
                            alert = uae;
                            return true;
                        }

                        return false;
                    });

                    if (alert != null)
                        throw alert;
                    return;
                }
                catch (StaleElementReferenceException) { }
                catch (WebDriverTimeoutException)
                {
                    if (elementPresent) 
                        throw new SeWaitForException("Element's text doesn't match.");
                    else
                        throw new SeElementNotFoundException();
                }
            }

            throw new StaleElementReferenceException();
        }

        public void SeCmdWaitForNotText(string target, string value)
        {
            string valCleaned = CollapseWhitespace(value);
            bool elementPresent = false;
            UnhandledAlertException alert = null;

            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                    {
                        try
                        {
                            var el = this.FindElement(ResolveLocator(target));
                            elementPresent = true;
                            return !MatchPattern(el.Text, valCleaned);
                        }
                        catch (NoSuchElementException)
                        {
                            elementPresent = false;
                        }
                        catch (UnhandledAlertException uae)
                        {
                            alert = uae;
                            return true;
                        }
                        return false;
                    });

                    if (alert != null)
                        throw alert;
                    return;
                }
                catch (StaleElementReferenceException) { }
                catch (WebDriverTimeoutException)
                {
                    if (elementPresent)
                        throw new SeWaitForException("Element's text does not not match.");
                    else
                        throw new SeElementNotFoundException();
                }
            }

            throw new StaleElementReferenceException();
        }

        public void SeCmdAssertValue(string target, string value)
        {
            this.SeCmdWaitForVisible(target, value);
            // assertValue asserts the value of an input field (or anything else with a value parameter). 
            // For checkbox/radio elements, the value will be "on" or "off" depending on whether the element is checked or not.
            // hence we need to take two different approaches when comparing depending if the element is radio/checkbox or something else

            var el = this.FindElement(ResolveLocator(target));

            var type = el.GetAttribute("type");
            if (type == null)
                throw new SeElementHasNoValueException(target);

            type = type.Trim().ToLower();

            if (type == "radio" || type == "checkbox")
            {
                if (el.Selected && value == "off" || !el.Selected && value == "on")
                    throw new SeAssertionException();
            }
            else
            {
                var elValue = el.GetAttribute("value");
                if (elValue == null)
                    throw new SeElementHasNoValueException(target);

                if (!MatchPattern(elValue, value))
                    throw new SeAssertionException();
            }
        }

        public void SeCmdWaitForValue(string target, string value)
        {
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                    {
                        try
                        {
                            var el = this.FindElement(ResolveLocator(target));
                            var type = el.GetAttribute("type");
                            if (type == null)
                                throw new SeElementHasNoValueException(target);
                            type = type.Trim().ToLower();

                            var elValue = el.GetAttribute("value");
                            if (elValue == null)
                                throw new SeElementHasNoValueException(target);

                            // waitForValue wait for a value of an input field (or anything else with a value parameter) to become equal to the provided value. 
                            // For checkbox/radio elements, the value will be "on" or "off" depending on whether the element is checked or not.
                            // hence we need to take two different approaches when comparing depending if the element is radio/checkbox or something else
                            if (type == "radio" || type == "checkbox")
                                return (el.Selected && value == "off" || !el.Selected && value == "on");
                            else
                                return MatchPattern(value, CollapseWhitespace(elValue));
                        }
                        catch (NoSuchElementException) { }

                        return false;
                    });

                    return;
                }
                catch (StaleElementReferenceException) { }
                catch (WebDriverTimeoutException)
                {
                    throw new SeWaitForException();
                }
            }
            throw new StaleElementReferenceException();
        }

        public void SeCmdWaitForNotValue(string target, string value)
        {
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    new WebDriverWait(this, TimeSpan.FromMilliseconds(waitForTimeout)).Until((d) =>
                    {
                        try
                        {
                            var el = this.FindElement(ResolveLocator(target));
                            var type = el.GetAttribute("type");
                            if (type == null)
                                throw new SeElementHasNoValueException(target);
                            type = type.Trim().ToLower();

                            var elValue = el.GetAttribute("value");
                            if (elValue == null)
                                throw new SeElementHasNoValueException(target);

                            // waitForValue wait for a value of an input field (or anything else with a value parameter) to become equal to the provided value. 
                            // For checkbox/radio elements, the value will be "on" or "off" depending on whether the element is checked or not.
                            // hence we need to take two different approaches when comparing depending if the element is radio/checkbox or something else
                            if (type == "radio" || type == "checkbox")
                                return !(el.Selected && value == "off" || !el.Selected && value == "on");
                            else
                                return !MatchPattern(value, CollapseWhitespace(elValue));
                        }
                        catch (NoSuchElementException) { }

                        return false;
                    });

                    return;
                }
                catch (StaleElementReferenceException) { }
                catch (WebDriverTimeoutException)
                {
                    throw new SeWaitForException();
                }
            }
            throw new StaleElementReferenceException();
        }

        private void SeCmdVerifyValue(string target, string value)
        {
            try
            {
                SeCmdAssertValue(target, value);
            }
            catch (SeAssertionException)
            {
                throw new SeVerificationException();
            }
        }

        private void SeCmdVerifyTextPresent(string target, string value)
        {
            try
            {
                SeCmdAssertTextPresent(target, value);
            }
            catch (SeAssertionException)
            {
                throw new SeVerificationException();
            }
        }

        private void SeCmdVerifyElementPresent(string target, string value)
        {
            try
            {
                SeCmdAssertElementPresent(target, value);
            }
            catch (SeAssertionException)
            {
                throw new SeVerificationException();
            }
        }

        public void SeCmdVerifyTitle(string target, string value)
        {
            try
            {
                SeCmdAssertTitle(target, value);
            }
            catch (SeAssertionException)
            {
                throw new SeVerificationException();
            }
        }

        private void SeCmdVerifyText(string target, string value)
        {
            try
            {
                SeCmdAssertText(target, value);
            }
            catch (SeAssertionException)
            {
                throw new SeVerificationException();
            }
        }

        public void SeCmdAssertText(string target, string value)
        {
            string text = null;

            bool success = false;
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    this.SeCmdWaitForVisible(target, value);

                    var el = this.FindElement(ResolveLocator(target));

                    new WebDriverWait(this, TimeSpan.FromSeconds(TIMEOUT_ASSERT)).Until((d) =>
                    {
                        return el.Displayed;
                    });

                    text = el.Text;

                    success = true;
                    break;
                }
                catch (StaleElementReferenceException) { }
                catch (InvalidOperationException ioe)
                {
                    throw new SeInvalidOperationException(ioe.Message, ioe);
                }
                catch (WebDriverTimeoutException)
                {
                    throw new SeAssertionException();
                }
            }

            if (!success)
                throw new StaleElementReferenceException();

            if (!MatchPattern(text, value))
                throw new SeAssertionException();
        }

        public void SeCmdAssertTextPresent(string target, string value)
        {
            var els = this.FindElements(By.XPath("//*[contains(text(),'" + target + "')]"));

            if (els.Count() == 0)
                throw new SeAssertionException();
        }

        public void SeCmdAssertElementPresent(string target, string value)
        {
            this.SeCmdWaitForElementPresent(target, value);
            if (!IsElementPresent(ResolveLocator(target)))
                throw new SeAssertionException();
        }

        public void SeCmdAssertAlert(string target, string value)
        {
            new WebDriverWait(this, TimeSpan.FromMilliseconds(TIMEOUT_ASSERT)).Until((d) =>
            {
                try
                {
                    var alert = base.SwitchTo().Alert();
                    if (!MatchPattern(alert.Text, target))
                        throw new SeAssertionException();

                    alert.Accept();
                    return true;
                }
                catch (NoAlertPresentException) { }

                return false;
            });
        }

        public void SeCmdAssertTitle(string target, string value)
        {
            try
            {
                new WebDriverWait(this, TimeSpan.FromSeconds(TIMEOUT_ASSERT)).Until((d) =>
                {
                    return MatchPattern(d.Title, target);
                });
            }
            catch (WebDriverTimeoutException)
            {
                throw new SeAssertionException();
            }
        }

        public bool SeCmdIsElementPresent(string target, string value)
        {
            int timeout;
            if (!int.TryParse(value, out timeout))
                timeout = waitForTimeout;

            try
            {
                new WebDriverWait(this, TimeSpan.FromMilliseconds(timeout)).Until((d) =>
                {
                    try
                    {
                        var el = this.FindElement(ResolveLocator(target));
                        return el != null;
                    }
                    catch (NoSuchElementException) { }

                    return false;
                });

                return true;
            }
            catch (WebDriverTimeoutException)
            {
                return false;
            }
        }

        public bool SeCmdIsElementVisible(string target, string value)
        {
            int timeout;
            if (!int.TryParse(value, out timeout))
                timeout = waitForTimeout;

            try
            {
                new WebDriverWait(this, TimeSpan.FromMilliseconds(timeout)).Until((d) =>
                {
                    try
                    {
                        var el = this.FindElement(ResolveLocator(target));
                        return el.Displayed;
                    }
                    catch (NoSuchElementException) { }

                    return false;
                });

                return true;
            }
            catch (WebDriverTimeoutException)
            {
                return false;
            }
        }
    }
}
