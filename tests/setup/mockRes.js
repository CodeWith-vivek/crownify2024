// Minimal Express res mock for calling controllers directly with a real
// in-memory DB but no HTTP layer — shared across integration tests instead
// of redefining the same status()/json() chain in each file.
function mockRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

module.exports = { mockRes };
