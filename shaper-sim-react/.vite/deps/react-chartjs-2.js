import { i as __toESM, n as __commonJSMin, t as require_react } from "./react-BDWiK9rz.js";
import { C as RadarController, E as ScatterController, S as PolarAreaController, b as PieController, c as BubbleController, g as LineController, i as BarController, p as DoughnutController, u as Chart$1 } from "./chart-bwEmpPHu.js";
//#region node_modules/react/cjs/react-jsx-runtime.development.js
/**
* @license React
* react-jsx-runtime.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_development = /* @__PURE__ */ __commonJSMin(((exports) => {
	(function() {
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
			var children = config.children;
			if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
				for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++) validateChildKeys(children[isStaticChildren]);
				Object.freeze && Object.freeze(children);
			} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
			else validateChildKeys(children);
			if (hasOwnProperty.call(config, "key")) {
				children = getComponentNameFromType(type);
				var keys = Object.keys(config).filter(function(k) {
					return "key" !== k;
				});
				isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
				didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
			}
			children = null;
			void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
			hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
			if ("key" in config) {
				maybeKey = {};
				for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
			} else maybeKey = config;
			children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		var React = require_react(), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		React = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutKeySpread = {};
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.jsx = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !1, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.jsxs = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !0, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
	})();
}));
//#endregion
//#region node_modules/react-chartjs-2/dist/index.js
var import_jsx_runtime = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_jsx_runtime_development();
})))();
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var defaultDatasetIdKey = "label";
function reforwardRef(ref, value) {
	if (typeof ref === "function") ref(value);
	else if (ref) ref.current = value;
}
function setOptions(chart, nextOptions) {
	const options = chart.options;
	if (options && nextOptions) Object.assign(options, nextOptions);
}
function setLabels(currentData, nextLabels) {
	currentData.labels = nextLabels;
}
function setDatasets(currentData, nextDatasets, datasetIdKey = defaultDatasetIdKey) {
	const addedDatasets = [];
	currentData.datasets = nextDatasets.map((nextDataset) => {
		const currentDataset = currentData.datasets.find((dataset) => dataset[datasetIdKey] === nextDataset[datasetIdKey]);
		if (!currentDataset || !nextDataset.data || addedDatasets.includes(currentDataset)) return { ...nextDataset };
		addedDatasets.push(currentDataset);
		Object.assign(currentDataset, nextDataset);
		return currentDataset;
	});
}
function cloneData(data, datasetIdKey = defaultDatasetIdKey) {
	const nextData = {
		labels: [],
		datasets: []
	};
	setLabels(nextData, data.labels);
	setDatasets(nextData, data.datasets, datasetIdKey);
	return nextData;
}
/**
* Get dataset from mouse click event
* @param chart - Chart.js instance
* @param event - Mouse click event
* @returns Dataset
*/ function getDatasetAtEvent(chart, event) {
	return chart.getElementsAtEventForMode(event.nativeEvent, "dataset", { intersect: true }, false);
}
/**
* Get single dataset element from mouse click event
* @param chart - Chart.js instance
* @param event - Mouse click event
* @returns Dataset
*/ function getElementAtEvent(chart, event) {
	return chart.getElementsAtEventForMode(event.nativeEvent, "nearest", { intersect: true }, false);
}
/**
* Get all dataset elements from mouse click event
* @param chart - Chart.js instance
* @param event - Mouse click event
* @returns Dataset
*/ function getElementsAtEvent(chart, event) {
	return chart.getElementsAtEventForMode(event.nativeEvent, "index", { intersect: true }, false);
}
function ChartComponent(props, ref) {
	const { height = 150, width = 300, redraw = false, datasetIdKey, type, data, options, plugins = [], fallbackContent, updateMode, ...canvasProps } = props;
	const canvasRef = (0, import_react.useRef)(null);
	const chartRef = (0, import_react.useRef)(null);
	const renderChart = () => {
		if (!canvasRef.current) return;
		chartRef.current = new Chart$1(canvasRef.current, {
			type,
			data: cloneData(data, datasetIdKey),
			options: options && { ...options },
			plugins
		});
		reforwardRef(ref, chartRef.current);
	};
	const destroyChart = () => {
		reforwardRef(ref, null);
		if (chartRef.current) {
			chartRef.current.destroy();
			chartRef.current = null;
		}
	};
	(0, import_react.useEffect)(() => {
		if (!redraw && chartRef.current && options) setOptions(chartRef.current, options);
	}, [redraw, options]);
	(0, import_react.useEffect)(() => {
		if (!redraw && chartRef.current) setLabels(chartRef.current.config.data, data.labels);
	}, [redraw, data.labels]);
	(0, import_react.useEffect)(() => {
		if (!redraw && chartRef.current && data.datasets) setDatasets(chartRef.current.config.data, data.datasets, datasetIdKey);
	}, [redraw, data.datasets]);
	(0, import_react.useEffect)(() => {
		if (!chartRef.current) return;
		if (redraw) {
			destroyChart();
			setTimeout(renderChart);
		} else chartRef.current.update(updateMode);
	}, [
		redraw,
		options,
		data.labels,
		data.datasets,
		updateMode
	]);
	(0, import_react.useEffect)(() => {
		if (!chartRef.current) return;
		destroyChart();
		setTimeout(renderChart);
	}, [type]);
	(0, import_react.useEffect)(() => {
		renderChart();
		return () => destroyChart();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		role: "img",
		height,
		width,
		...canvasProps,
		children: fallbackContent
	});
}
var Chart = /* @__PURE__ */ (0, import_react.forwardRef)(ChartComponent);
function createTypedChart(type, registerables) {
	Chart$1.register(registerables);
	return /* @__PURE__ */ (0, import_react.forwardRef)((props, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chart, {
		...props,
		ref,
		type
	}));
}
var Line = /* @__PURE__ */ createTypedChart("line", LineController);
var Bar = /* @__PURE__ */ createTypedChart("bar", BarController);
var Radar = /* @__PURE__ */ createTypedChart("radar", RadarController);
var Doughnut = /* @__PURE__ */ createTypedChart("doughnut", DoughnutController);
var PolarArea = /* @__PURE__ */ createTypedChart("polarArea", PolarAreaController);
var Bubble = /* @__PURE__ */ createTypedChart("bubble", BubbleController);
var Pie = /* @__PURE__ */ createTypedChart("pie", PieController);
var Scatter = /* @__PURE__ */ createTypedChart("scatter", ScatterController);
//#endregion
export { Bar, Bubble, Chart, Doughnut, Line, Pie, PolarArea, Radar, Scatter, getDatasetAtEvent, getElementAtEvent, getElementsAtEvent };

//# sourceMappingURL=react-chartjs-2.js.map