"use strict";


// =============================================================================
// Polyfills — must run BEFORE any require() that loads azure-pipelines-task-lib
// or dist/index.js, so that patched built-ins are visible to all modules.
// =============================================================================

const crypto = require("crypto");

// crypto.randomUUID — added in Node 14.17.0.
if (typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = function randomUUID() {
    var bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var h = bytes.toString("hex");
    return (
      h.slice(0, 8)  + "-" +
      h.slice(8, 12) + "-" +
      h.slice(12, 16) + "-" +
      h.slice(16, 20) + "-" +
      h.slice(20, 32)
    );
  };
}

// globalThis — added in Node 12.0.0.
if (typeof globalThis === "undefined") {
  global.globalThis = global;
}

// Object.fromEntries — added in Node 12.0.0.
if (typeof Object.fromEntries !== "function") {
  Object.fromEntries = function fromEntries(iterable) {
    return Array.from(iterable).reduce(function (obj, pair) {
      obj[pair[0]] = pair[1];
      return obj;
    }, {});
  };
}

// Array.prototype.flat — added in Node 11.0.0.
if (typeof Array.prototype.flat !== "function") {
  Array.prototype.flat = function flat(depth) {
    var d = depth === undefined ? 1 : Math.floor(depth);
    if (d < 1) return Array.prototype.slice.call(this);
    return Array.prototype.reduce.call(this, function (acc, val) {
      if (Array.isArray(val) && d > 0) {
        acc.push.apply(acc, val.flat(d - 1));
      } else {
        acc.push(val);
      }
      return acc;
    }, []);
  };
}

// Array.prototype.flatMap — added in Node 11.0.0.
if (typeof Array.prototype.flatMap !== "function") {
  Array.prototype.flatMap = function flatMap(fn, thisArg) {
    return Array.prototype.map.call(this, fn, thisArg).flat(1);
  };
}

// Promise.allSettled — added in Node 12.9.0.
if (typeof Promise.allSettled !== "function") {
  Promise.allSettled = function allSettled(promises) {
    return Promise.all(
      Array.from(promises).map(function (p) {
        return Promise.resolve(p).then(
          function (value)  { return { status: "fulfilled", value: value };  },
          function (reason) { return { status: "rejected",  reason: reason }; }
        );
      })
    );
  };
}

// String.prototype.trimStart / trimEnd — added in Node 10.0.0.
if (typeof String.prototype.trimStart !== "function") {
  String.prototype.trimStart = function trimStart() { return this.replace(/^\s+/, ""); };
}
if (typeof String.prototype.trimEnd !== "function") {
  String.prototype.trimEnd = function trimEnd() { return this.replace(/\s+$/, ""); };
}

// queueMicrotask — added in Node 11.0.0.
if (typeof queueMicrotask !== "function") {
  global.queueMicrotask = function queueMicrotask(fn) { Promise.resolve().then(fn); };
}

// =============================================================================
// Runtime version check
// =============================================================================

function getNodeMajorVersion() {
  return parseInt(process.versions.node.split(".")[0], 10);
}

function validateNodeVersion() {
  var major = getNodeMajorVersion();
  if (major < 16) {
    var msg =
      "The OpenText Enterprise Performance Engineering Workspace Sync task requires Node.js 16 or later." +
      " Your Azure DevOps agent is running Node " + process.version + "." +
      " Please upgrade the agent to version 3.x (or later) so it includes the" +
      " Node 20 externals, or install a newer agent on this machine." +
      " See https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/agents";
    console.error("##vso[task.logissue type=error]" + msg);
    console.error("##vso[task.complete result=Failed;]Task failed: " + msg);
    process.exit(1);
  } else if (major < 20) {
    console.warn(
      "WARNING: Running the OpenText Enterprise Performance Engineering Workspace Sync task on Node " +
      process.version + ". Node 20+ is recommended."
    );
  }
}

validateNodeVersion();

// =============================================================================
// Load main bundle
// =============================================================================

console.log(
  "[LRE Workspace Sync Bootstrap] Node runtime: " + process.version +
  " -> ./dist/LreWorkspaceSyncTask/index.js"
);

var runtimeModule = require("./dist/LreWorkspaceSyncTask/index.js");

if (runtimeModule && typeof runtimeModule.runEntrypoint === "function") {
  module.exports = runtimeModule;
  if (require.main === module) {
    void runtimeModule.runEntrypoint();
  }
} else {
  module.exports = runtimeModule;
}

