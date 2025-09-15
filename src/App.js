"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var proto_parser_1 = require("./lib/proto-parser");
var PackageDocumentationView_1 = require("./components/PackageDocumentationView");
var PackageListView_1 = require("./components/PackageListView");
var ScrollToTop_1 = require("./components/ScrollToTop");
var ErrorPage_1 = require("./components/ErrorPage");
function App() {
    var _this = this;
    var _a = (0, react_1.useState)([]), files = _a[0], setFiles = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(false), showSourceInfoWarning = _d[0], setShowSourceInfoWarning = _d[1];
    var _e = (0, react_1.useState)(null), config = _e[0], setConfig = _e[1];
    var _f = (0, react_1.useState)(function () {
        var savedMode = localStorage.getItem('darkMode');
        return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }), isDarkMode = _f[0], setIsDarkMode = _f[1];
    (0, react_1.useEffect)(function () {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        }
        else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);
    var toggleDarkMode = function () {
        setIsDarkMode(function (prevMode) { return !prevMode; });
    };
    (0, react_1.useEffect)(function () {
        var fetchConfigAndDescriptors = function () { return __awaiter(_this, void 0, void 0, function () {
            var configResponse, configData, files_1, responses, _i, responses_1, response, buffers, _a, buffers_1, buffer, err_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 9, 10, 11]);
                        return [4 /*yield*/, fetch('/config.json')];
                    case 1:
                        configResponse = _b.sent();
                        if (!configResponse.ok) {
                            throw new Error('Failed to fetch config.json');
                        }
                        return [4 /*yield*/, configResponse.json()];
                    case 2:
                        configData = _b.sent();
                        setConfig(configData);
                        document.title = configData.title;
                        files_1 = configData.descriptor_files;
                        return [4 /*yield*/, Promise.all(files_1.map(function (file) { return fetch(file); }))];
                    case 3:
                        responses = _b.sent();
                        for (_i = 0, responses_1 = responses; _i < responses_1.length; _i++) {
                            response = responses_1[_i];
                            if (!response.ok) {
                                throw new Error("Failed to fetch descriptors from ".concat(response.url));
                            }
                        }
                        return [4 /*yield*/, Promise.all(responses.map(function (res) { return res.arrayBuffer(); }))];
                    case 4:
                        buffers = _b.sent();
                        _a = 0, buffers_1 = buffers;
                        _b.label = 5;
                    case 5:
                        if (!(_a < buffers_1.length)) return [3 /*break*/, 8];
                        buffer = buffers_1[_a];
                        return [4 /*yield*/, (0, proto_parser_1.loadDescriptors)(buffer, setFiles, setError, setShowSourceInfoWarning)];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        _a++;
                        return [3 /*break*/, 5];
                    case 8: return [3 /*break*/, 11];
                    case 9:
                        err_1 = _b.sent();
                        setError('Failed to load descriptors.');
                        console.error(err_1);
                        return [3 /*break*/, 11];
                    case 10:
                        setLoading(false);
                        document.body.classList.remove('loading');
                        return [7 /*endfinally*/];
                    case 11: return [2 /*return*/];
                }
            });
        }); };
        fetchConfigAndDescriptors();
    }, []);
    var packages = files.reduce(function (acc, file) {
        if (!acc[file.package]) {
            acc[file.package] = [];
        }
        acc[file.package].push(file);
        return acc;
    }, {});
    var protoPackages = Object.entries(packages).map(function (_a) {
        var name = _a[0], files = _a[1];
        return ({ name: name, files: files });
    });
    if (loading) {
        return null;
    }
    if (error) {
        return <ErrorPage_1.default title="Error" message={error}/>;
    }
    return (<react_router_dom_1.BrowserRouter>
        <ScrollToTop_1.default />
        <button onClick={toggleDarkMode} className="fixed bottom-4 right-4 p-2 rounded-full bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800 shadow-lg z-50" aria-label="Toggle dark mode">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        {showSourceInfoWarning && (<div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
                <p className="font-bold">Warning</p>
                <p>Comments and some other source information may not be displayed. To enable this, generate your descriptor files with the `--include-source-info` flag.</p>
            </div>)}
        <react_router_dom_1.Routes>
            <react_router_dom_1.Route path="/" element={<PackageListView_1.default packages={protoPackages} config={config}/>}/>
            <react_router_dom_1.Route path="/package/:packageName" element={<PackageDocumentationView_1.default packages={protoPackages}/>}/>
            
            <react_router_dom_1.Route path="/package/:packageName/files/:fileName" element={<PackageDocumentationView_1.default packages={protoPackages}/>}/>
            <react_router_dom_1.Route path="/package/:packageName/:itemType/:itemName" element={<PackageDocumentationView_1.default packages={protoPackages}/>}/>
        </react_router_dom_1.Routes>
    </react_router_dom_1.BrowserRouter>);
}
