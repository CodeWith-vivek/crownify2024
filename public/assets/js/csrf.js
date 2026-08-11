(function () {
  var meta = document.querySelector('meta[name="csrf-token"]');
  var token = meta ? meta.getAttribute('content') : '';
  if (!token) return;

  var UNSAFE = ["POST", "PUT", "PATCH", "DELETE"];

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      var method = (form.getAttribute("method") || "GET").toUpperCase();
      if (UNSAFE.indexOf(method) === -1) return;
      if (form.querySelector('input[name="_csrf"]')) return;
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "_csrf";
      input.value = token;
      form.appendChild(input);
    },
    true
  );

  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function (input, init) {
      init = init || {};
      var method = (init.method || "GET").toUpperCase();
      if (UNSAFE.indexOf(method) !== -1) {
        init.headers = new Headers(init.headers || {});
        if (!init.headers.has("X-CSRF-Token")) {
          init.headers.set("X-CSRF-Token", token);
        }
      }
      return originalFetch.call(this, input, init);
    };
  }

  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method) {
    this._csrfMethod = (method || "GET").toUpperCase();
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (UNSAFE.indexOf(this._csrfMethod) !== -1) {
      this.setRequestHeader("X-CSRF-Token", token);
    }
    return originalSend.apply(this, arguments);
  };
})();
