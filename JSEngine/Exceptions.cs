﻿using System;

namespace CloudBeat.Selenium.JSEngine
{
    public class JSEngineException : Exception
    {
        public JSEngineException()
        {
        }

        public JSEngineException(string message, Exception innerException)
            : base(message, innerException)
        {
        }

        public JSEngineException(string message)
            : base(message)
        {
        }
    }
}
