web.init();
web.setTimeout(6000);
web.open("wikipedia.org");
web.assertSelectedLabel("id=searchLanguage", "Not valid text", 600, false);