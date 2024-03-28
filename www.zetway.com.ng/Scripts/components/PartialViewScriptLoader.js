var app = app || {};
(function($) {
    var UrlStates = {
        LOADING: 'LOADING',
        LOADED: 'LOADED',
        FAILED: 'FAILED'
    };

    function UrlInfo() {
        this.state = UrlStates.LOADING;
        this.loadCallbacks = [];
        this.failCallbacks = [];
    }
    UrlInfo.prototype.succeed = function() {
        this.state = UrlStates.LOADED;
        for (var i = 0; i < this.loadCallbacks.length; i++) {
            this.loadCallbacks[i]();
        }
    };
    UrlInfo.prototype.failed = function() {
        this.state = UrlStates.FAILED;
        for (var i = 0; i < this.failCallbacks.length; i++) {
            this.failCallbacks[i]();
        }
    };
    UrlInfo.prototype.handleCallbacks = function(loadCallback, failCallback) {
        switch (this.state) {
            case UrlStates.LOADED:
                loadCallback && loadCallback();
                break;
            case UrlStates.FAILED:
                failCallback && failCallback();
                break;
            case UrlStates.LOADING:
                this.addCallbacks(loadCallback, failCallback);
                break;
        }
    };
    UrlInfo.prototype.addCallbacks = function(loadCallback, failCallback) {
        loadCallback && this.loadCallbacks.push(loadCallback);
        failCallback && this.failCallbacks.push(failCallback);
    };
    app.ResourceLoader = (function() {
        var _urlInfos = {};
        var _loadScript = function(url, loadCallback, failCallback) {
            if (document.querySelector('#PartialViewScriptLoaderVer') != null) {
                url += '?ver=' + document.querySelector('#PartialViewScriptLoaderVer').value;
            }
            var urlInfo = _urlInfos[url];
            if (urlInfo) {
                urlInfo.handleCallbacks(loadCallback, failCallback);
                return;
            }
            _urlInfos[url] = urlInfo = new UrlInfo();
            urlInfo.addCallbacks(loadCallback, failCallback);
            $.getScript(url).done(function(script, textStatus) {
                urlInfo.succeed();
            }).fail(function(jqxhr, settings, exception) {
                urlInfo.failed();
            });
        };
        return {
            loadScript: _loadScript
        }
    })();
})(jQuery);
(function($) {
    app.partialViews = app.partialViews || {};
    app.PartialViewScripLoader = (function() {
        return function() {
            var _publicApi = null;

            function _initSinglePartial(options) {
                if (options.scriptUrl) {
                    _checkForRequiredOptions(options);
                    app.ResourceLoader.loadScript(options.scriptUrl, function() {
                        var partialViewClass = app.partialViews[options.partialViewClass];
                        if (partialViewClass) {
                            var partialViewObject = new partialViewClass();
                            if (partialViewObject.init) {
                                partialViewObject.init(options);
                            }
                        } else {
                            throw options.partialViewClass + " could not be found in app.partialViews";
                        }
                    });
                }
            }

            function _initAllPartials() {
                $('.partial-view-script-loader').each(function() {
                    var partialMetaData = $(this).data();
                    if (partialMetaData.scriptUrl !== null) {
                        console.log(partialMetaData);
                        _initSinglePartial({
                            elem: $(this),
                            scriptUrl: '/' + partialMetaData.scriptUrl,
                            partialViewClass: partialMetaData.partialViewClass,
                            partialId: partialMetaData.partialId
                        });
                    }
                });
            }

            function _checkForRequiredOptions(options) {
                if (!options.partialViewClass) {
                    throw "partialViewClass option is missing";
                }
                if (!options.partialId) {
                    throw "partialId option is missing";
                }
            }
            _publicApi = {
                initSinglePartial: (options) => _initSinglePartial(options),
                initAllPartials: _initAllPartials
            };
            return _publicApi;
        };
    })();
})(jQuery);