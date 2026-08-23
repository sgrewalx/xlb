import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyGa4Data,
  fetchGa4Snapshot,
  getGa4Window,
  parseGa4Totals,
  runGa4Report,
  verifyGa4StreamIdentity,
} from "./fetch-ga4.mjs";

const propertyId = "530268584";
const measurementId = "G-5JECBDGEMT";
const window = getGa4Window({ snapshotDate: "2026-08-23", lookbackDays: 7 });

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function streamBody(overrides = {}) {
  return {
    dataStreams: [{
      name: `properties/${propertyId}/dataStreams/123`,
      type: "WEB_DATA_STREAM",
      displayName: "XLB",
      webStreamData: {
        measurementId,
        defaultUri: "https://xlb.codemachine.in/",
      },
      ...overrides,
    }],
  };
}

function totalsRow(values) {
  return { rows: [{ metricValues: values.map((value) => ({ value: String(value) })) }] };
}

function gaRequest({ pageRows = [], totals = [0, 0, 0, 0], admin = streamBody() } = {}) {
  return async (url, options = {}) => {
    if (url.includes("analyticsadmin.googleapis.com")) {
      return response(admin);
    }
    const body = JSON.parse(options.body);
    if (body.metrics?.[0]?.name === "totalUsers") {
      return response(totalsRow(totals));
    }
    if (body.dimensions?.length === 2) {
      return response({ rows: [], rowCount: 0 });
    }
    return response({ rows: pageRows, rowCount: pageRows.length });
  };
}

function collectFilters(expression) {
  if (expression?.filter) {
    return [expression.filter];
  }
  return [
    ...(expression?.andGroup?.expressions ?? []),
    ...(expression?.orGroup?.expressions ?? []),
  ].flatMap(collectFilters);
}

function filterFor(body, fieldName) {
  return collectFilters(body.dimensionFilter).find((filter) => filter.fieldName === fieldName);
}

test("GA4 stream identity matches property, measurement ID, and XLB URI", async () => {
  const stream = await verifyGa4StreamIdentity({
    accessToken: "token",
    propertyId,
    expectedMeasurementId: measurementId,
    request: gaRequest(),
  });

  assert.equal(stream.name, `properties/${propertyId}/dataStreams/123`);
  assert.equal(stream.streamId, "123");
  assert.equal(stream.measurementId, measurementId);
  assert.equal(stream.defaultUri, "https://xlb.codemachine.in/");
});

test("GA4 reports are all scoped to the verified stream ID", async () => {
  const reportBodies = [];
  const request = gaRequest();
  await fetchGa4Snapshot({
    accessToken: "token",
    propertyId,
    expectedMeasurementId: measurementId,
    window,
    request: async (url, options) => {
      if (url.includes("analyticsdata.googleapis.com")) {
        reportBodies.push(JSON.parse(options.body));
      }
      return request(url, options);
    },
  });

  assert.equal(reportBodies.length, 3);
  for (const body of reportBodies) {
    assert.deepEqual(filterFor(body, "streamId"), {
      fieldName: "streamId",
      stringFilter: {
        matchType: "EXACT",
        value: "123",
      },
    });
  }

  const outboundBody = reportBodies.find((body) => body.dimensions?.some(({ name }) => name === "eventName"));
  assert.equal(outboundBody.dimensionFilter.andGroup.expressions.length, 2);
  assert.deepEqual(filterFor(outboundBody, "eventName"), {
    fieldName: "eventName",
    inListFilter: {
      values: [
        "watch_source",
        "open_source",
        "video_play_start",
        "video_play_complete",
        "video_scroll_depth",
        "game_start",
        "game_complete",
        "gallery_card_open",
        "home_live_card_click",
        "return_visit_entry",
      ],
    },
  });
});

test("another stream in the property cannot influence XLB totals or status", async () => {
  const xlbStream = streamBody().dataStreams[0];
  const admin = {
    dataStreams: [
      xlbStream,
      {
        name: `properties/${propertyId}/dataStreams/999`,
        type: "WEB_DATA_STREAM",
        displayName: "Other site",
        webStreamData: {
          measurementId: "G-OTHER123",
          defaultUri: "https://example.com",
        },
      },
    ],
  };
  const otherStreamPage = {
    dimensionValues: [{ value: "/other-site" }],
    metricValues: ["12", "4", "0.8", "30"].map((value) => ({ value })),
  };
  const request = async (url, options = {}) => {
    if (url.includes("analyticsadmin.googleapis.com")) {
      return response(admin);
    }

    const body = JSON.parse(options.body);
    const requestedStream = filterFor(body, "streamId")?.stringFilter?.value;
    const isXlbOnly = requestedStream === "123";
    if (body.metrics?.[0]?.name === "totalUsers") {
      return response(totalsRow(isXlbOnly ? [0, 0, 0, 0] : [4, 4, 12, 20]));
    }
    if (body.dimensions?.length === 2) {
      return response({ rows: [], rowCount: 0 });
    }
    return response(isXlbOnly
      ? { rows: [], rowCount: 0 }
      : { rows: [otherStreamPage], rowCount: 1 });
  };

  const snapshot = await fetchGa4Snapshot({
    accessToken: "token",
    propertyId,
    expectedMeasurementId: measurementId,
    window,
    request,
  });

  assert.equal(snapshot.ga4.stream.streamId, "123");
  assert.equal(snapshot.ga4.dataStatus, "no-events-observed");
  assert.deepEqual(snapshot.ga4.totals, {
    totalUsers: 0,
    sessions: 0,
    screenPageViews: 0,
    eventCount: 0,
  });
  assert.deepEqual(snapshot.pages, []);
});

test("GA4 stream mismatch fails closed", async () => {
  const admin = streamBody({
    webStreamData: { measurementId: "G-WRONG123", defaultUri: "https://xlb.codemachine.in" },
  });
  await assert.rejects(
    verifyGa4StreamIdentity({
      accessToken: "token",
      propertyId,
      expectedMeasurementId: measurementId,
      request: gaRequest({ admin }),
    }),
    /expected XLB web data stream/,
  );
  const wrongUri = streamBody({
    webStreamData: { measurementId, defaultUri: "https://example.com" },
  });
  await assert.rejects(
    verifyGa4StreamIdentity({
      accessToken: "token",
      propertyId,
      expectedMeasurementId: measurementId,
      request: gaRequest({ admin: wrongUri }),
    }),
    /expected XLB web data stream/,
  );
  const invalidResourceName = streamBody({
    name: `properties/${propertyId}/dataStreams/not-numeric`,
  });
  await assert.rejects(
    verifyGa4StreamIdentity({
      accessToken: "token",
      propertyId,
      expectedMeasurementId: measurementId,
      request: gaRequest({ admin: invalidResourceName }),
    }),
    /expected XLB web data stream/,
  );
});

test("valid zero totals and zero rows produce verified no-events status", async () => {
  const snapshot = await fetchGa4Snapshot({
    accessToken: "token",
    propertyId,
    expectedMeasurementId: measurementId,
    window,
    request: gaRequest(),
  });

  assert.equal(snapshot.ga4.dataStatus, "no-events-observed");
  assert.equal(snapshot.ga4.streamVerified, true);
  assert.deepEqual(snapshot.ga4.totals, {
    totalUsers: 0,
    sessions: 0,
    screenPageViews: 0,
    eventCount: 0,
  });
  assert.deepEqual(snapshot.pages, []);
});

test("non-zero totals and page rows produce data status", async () => {
  const pageRows = [{
    dimensionValues: [{ value: "/live" }],
    metricValues: ["5", "2", "0.5", "12"].map((value) => ({ value })),
  }];
  const snapshot = await fetchGa4Snapshot({
    accessToken: "token",
    propertyId,
    expectedMeasurementId: measurementId,
    window,
    request: gaRequest({ pageRows, totals: [2, 2, 5, 10] }),
  });

  assert.equal(snapshot.ga4.dataStatus, "data");
  assert.equal(snapshot.ga4.rowCount, 1);
  assert.equal(snapshot.pages[0].path, "/live");
  assert.equal(snapshot.pages[0].pageviews, 5);
});

test("non-zero totals with zero page rows is inconsistent and fails", async () => {
  assert.equal(
    classifyGa4Data({
      totals: { totalUsers: 1, sessions: 1, screenPageViews: 1, eventCount: 2 },
      rowCount: 0,
      pageCount: 0,
    }),
    "inconsistent",
  );
  await assert.rejects(
    fetchGa4Snapshot({
      accessToken: "token",
      propertyId,
      expectedMeasurementId: measurementId,
      window,
      request: gaRequest({ totals: [1, 1, 1, 2] }),
    }),
    /inconsistent/,
  );
});

test("malformed GA4 totals fail closed", () => {
  assert.throws(() => parseGa4Totals({ rows: [] }), /missing required metrics/);
  assert.throws(
    () => parseGa4Totals(totalsRow([1, 1, "not-a-number", 2])),
    /invalid screenPageViews/,
  );
});

test("GA4 Admin and Data API failures propagate", async () => {
  await assert.rejects(
    verifyGa4StreamIdentity({
      accessToken: "token",
      propertyId,
      expectedMeasurementId: measurementId,
      request: async () => response({ error: "denied" }, 403),
    }),
    /Admin API request failed: 403/,
  );
  await assert.rejects(
    runGa4Report({
      accessToken: "token",
      propertyId,
      body: {},
      request: async () => response({ error: "denied" }, 403),
    }),
    /Data API request failed: 403/,
  );
});

test("GA4 date window is deterministic and end-exclusive in the snapshot", () => {
  assert.deepEqual(window, {
    capturedAt: "2026-08-23T06:00:00.000Z",
    startDate: "2026-08-16",
    endDate: "2026-08-22",
    startIso: "2026-08-16T00:00:00.000Z",
    endIso: "2026-08-23T00:00:00.000Z",
  });
  assert.throws(
    () => getGa4Window({ snapshotDate: "2026-08-23", lookbackDays: 0 }),
    /Invalid XLB_GA4_LOOKBACK_DAYS/,
  );
});
