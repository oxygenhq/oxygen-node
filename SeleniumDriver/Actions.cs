﻿using OpenQA.Selenium;
using OpenQA.Selenium.Interactions;
using OpenQA.Selenium.Support.UI;
using System;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading;

namespace CloudBeat.Selenium
{
    public partial class SeleniumDriver
    {
        public void SeCmdSetTimeout(string target, string value)
        {
            pageLoadTimeout = waitForTimeout = asynScriptTimeout = int.Parse(target);
            base.Manage().Timeouts().SetPageLoadTimeout(TimeSpan.FromMilliseconds(pageLoadTimeout));
            base.Manage().Timeouts().SetScriptTimeout(TimeSpan.FromMilliseconds(asynScriptTimeout));
        }

        // implicit *AndWait assumed
        public void SeCmdOpen(string target, string value)
        {
            string url;

            if (BaseURL == null)
                url = target;
            else if (BaseURL.EndsWith("/") && target == "/")
                url = BaseURL;
            else if (target.StartsWith("http:") || target.StartsWith("https:"))
                url = target;
            else
                url = BaseURL + target;

            this.Navigate().GoToUrl(url);
        }

        public void SeCmdPoint(string target, string value)
        {
            bool success = false;
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    Actions actions = new Actions(this);
                    actions.MoveToElement(this.FindElement(ResolveLocator(target))).Perform();
                    success = true;
                    break;
                }
                catch (StaleElementReferenceException)
                {
                    Thread.Sleep(500);
                }
            }

            if (!success)
                throw new StaleElementReferenceException();
        }

        private int windowsCount;
        public void SeCmdClick(string target, string value)
        {
            windowsCount = base.WindowHandles.Count();

            bool success = false;
            // since FindElement and Click is not an atomic operation, there could be a race condition when we get the element but some javascript changes it before Display.Get
            // in which case a StaleElementReference exception is thrown.
            // we try to resolve this by refetching the element up to STALE_ELEMENT_ATTEMPTS times 
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    this.FindElement(ResolveLocator(target)).Click();
                    success = true;
                    break;
                }
                catch (StaleElementReferenceException)
                {
                    Thread.Sleep(500);              // FIXME: should find a better way to delay retries
                }
                catch (InvalidOperationException) { }
            }

            if (!success)
                throw new StaleElementReferenceException();
        }

        public void SeCmdClickHidden(string target, string value)
        {
            windowsCount = base.WindowHandles.Count();

            bool success = false;
            // since FindElement and Click is not an atomic operation, there could be a race condition when we get the element but some javascript changes it before Display.Get
            // in which case a StaleElementReference exception is thrown.
            // we try to resolve this by refetching the element up to STALE_ELEMENT_ATTEMPTS times 
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    var el = this.FindElement(ResolveLocator(target));
                    (this as IJavaScriptExecutor).ExecuteScript("var clck_ev = document.createEvent('MouseEvent');clck_ev.initEvent('click', true, true);arguments[0].dispatchEvent(clck_ev)", el);
                    success = true;
                    break;
                }
                catch (StaleElementReferenceException)
                {
                    Thread.Sleep(500);              // FIXME: should find a better way to delay retries
                }
                catch (InvalidOperationException) { }
            }

            if (!success)
                throw new StaleElementReferenceException();
        }

        public void SeCmdDoubleClick(string target, string value)
        {
            bool success = false;
            // since FindElement.Displayed is not an atomic operation, there could be a race condition when we get the element but some javascript changes it before Display.Get
            // in which case a StaleElementReference exception is thrown.
            // we try to resolve this by refetching the element up to STALE_ELEMENT_ATTEMPTS times 
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    var el = this.FindElement(ResolveLocator(target));

                    Actions actionProvider = new Actions(this);
                    IAction dblClick = actionProvider.DoubleClick(el).Build();
                    dblClick.Perform();

                    success = true;
                    break;
                }
                catch (StaleElementReferenceException) { }
                catch (InvalidOperationException) { }
            }

            if (!success)
                throw new StaleElementReferenceException();
        }

        public void SeCmdSendKeys(string target, string value)
        {
            var locator = ResolveLocator(target);
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    this.FindElement(locator).SendKeys(value);
                    return;
                }
                catch (StaleElementReferenceException) { }
            }
        }

        public void SeCmdClear(string target, string value)
        {
            var locator = ResolveLocator(target);
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    this.FindElement(locator).Clear();
                    return;
                }
                catch (StaleElementReferenceException) { }
            }
        }

        public void SeCmdType(string target, string value)
        {
            var locator = ResolveLocator(target);
            for (int i = 0; i < STALE_ELEMENT_ATTEMPTS; i++)
            {
                try
                {
                    var el = this.FindElement(locator);

                    if (el.Displayed)
                        el.SendKeys(value);
                    else
                        (this as IJavaScriptExecutor).ExecuteScript("arguments[0].value='" + value + "'", el); // it's ok to just set the value since 'type' not supposed to send keys anyway

                    return;
                }
                catch (StaleElementReferenceException) { }
            }
        }


        // NOTE: doesn't support pattern matching for label= and value= locators and does exact match instead.
        public void SeCmdSelect(string target, string value)
        {
            string selArg;
            string selectorMethod = ParseSelector(value, out selArg);
            SelectElement sel = new SelectElement(this.FindElement(ResolveLocator(target)));
            Type type = typeof(SelectElement);
            MethodInfo cmdMethod = type.GetMethod(selectorMethod, BindingFlags.Public | BindingFlags.IgnoreCase | BindingFlags.Instance);
            cmdMethod.Invoke(sel, new object[] { selArg });
        }

        public void SeCmdPause(string target, string value)
        {
            int time;
            if (int.TryParse(target, out time))
                Thread.Sleep(time);
        }

        public void SeCmdWaitForPopUp(string target, string value)
        {
            if (string.IsNullOrWhiteSpace(target))
            {
                new WebDriverWait(this, TimeSpan.FromMilliseconds(long.Parse(value))).Until((d) =>
                {
                    try
                    {
                        return windowsCount < base.WindowHandles.Count();
                    }
                    catch (NoSuchWindowException) { }

                    return false;
                });
            }
            else
            {
                var curWinHandle = base.CurrentWindowHandle;

                new WebDriverWait(this, TimeSpan.FromMilliseconds(long.Parse(value))).Until((d) =>
                {
                    try
                    {
                        SwitchTo().Window(target);
                        SwitchTo().Window(curWinHandle);
                        return true;
                    }
                    catch (NoSuchWindowException) { }

                    return false;
                });
            }
        }

        public void SeCmdSelectWindow(string target, string value)
        {
            if (target.StartsWith("title="))
            {
                string title = Regex.Replace(target.Substring("title=".Length).Trim(), @"\s+", " ");
                bool success = false;
                foreach (string handle in base.WindowHandles)
                {
                    if (base.SwitchTo().Window(handle).Title.Equals(title, StringComparison.InvariantCultureIgnoreCase))
                    {
                        success = true;
                        break;
                    }
                }

                if (!success)
                    throw new Exception("selectWindow cannot find window using locator '" + target + "'");
            }
            else if (target.StartsWith("name="))
            {
                SwitchTo().Window(target.Substring("name=".Length));
            }
            else
            {
                throw new SeCommandNotImplementedException("Unsuported locator in SelectWindow - " + target);
            }
        }

        public void SeCmdSelectFrame(string target, string value)
        {
            if (target.StartsWith("index="))
            {
                int index = int.Parse(target.Substring("index=".Length));
                SwitchTo().Frame(index);
            }
            else if (target == "relative=parent" || target == "relative=up")
            {
                SwitchTo().ParentFrame();
            }
            else if (target == "relative=top")
            {
                SwitchTo().DefaultContent();
            }
            else if (target.StartsWith("dom="))
            {
                throw new SeCommandNotImplementedException("'dom=' locator in SelectFrame is not supported");
            }
            else
            {
                SwitchTo().Frame(target);
            }
        }
    }
}
