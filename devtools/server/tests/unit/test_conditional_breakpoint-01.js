/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
/* eslint-disable no-shadow, max-nested-callbacks */

"use strict";

/**
 * Check conditional breakpoint when condition evaluates to true.
 */

var gDebuggee;
var gClient;
var gThreadClient;

function run_test() {
  initTestDebuggerServer();
  gDebuggee = addTestGlobal("test-conditional-breakpoint");
  gClient = new DebuggerClient(DebuggerServer.connectPipe());
  gClient.connect().then(function() {
    attachTestTabAndResume(gClient, "test-conditional-breakpoint",
                           function(response, targetFront, threadClient) {
                             gThreadClient = threadClient;
                             test_simple_breakpoint();
                           });
  });
  do_test_pending();
}

function test_simple_breakpoint() {
  let hitBreakpoint = false;

  gThreadClient.addOneTimeListener("paused", async function(event, packet) {
    const source = await getSourceById(
      gThreadClient,
      packet.frame.where.actor
    );
    const location = { sourceUrl: source.url, line: 3 };
    gThreadClient.setBreakpoint(location, { condition: "a === 1" });
    gThreadClient.addOneTimeListener("paused", function(event, packet) {
      Assert.equal(hitBreakpoint, false);
      hitBreakpoint = true;

      // Check the return value.
      Assert.equal(packet.why.type, "breakpoint");
      Assert.equal(packet.frame.where.line, 3);

      // Remove the breakpoint.
      gThreadClient.removeBreakpoint(location);

      gThreadClient.resume(function() {
        finishClient(gClient);
      });
    });

    // Continue until the breakpoint is hit.
    gThreadClient.resume();
  });

  /* eslint-disable */
  Cu.evalInSandbox("debugger;\n" +   // 1
                   "var a = 1;\n" +  // 2
                   "var b = 2;\n",  // 3
                   gDebuggee,
                   "1.8",
                   "test.js",
                   1);
  /* eslint-enable */

  Assert.equal(hitBreakpoint, true);
}
