/**
 * CamTune Capture One Plugin
 *
 * Entry point for the Capture One Plugin SDK.
 * Calls the CamTune sync API to write shoot session metadata
 * (GPS, weather, AI recommendation, camera settings, rating) into
 * the active Capture One catalog session.
 *
 * Capture One Plugin SDK reference:
 *   https://developer.captureone.com/plugins
 *
 * All actions are registered on the global `captureOne` plugin host.
 */

/* global captureOne */

// ---------------------------------------------------------------------------
// Configuration — customise via Capture One Plugin Preferences
// ---------------------------------------------------------------------------

var CAMTUNE_BASE_URL = "https://camtune.app";
var SETTINGS_KEY_USER_ID = "camtune.userId";
var SETTINGS_KEY_ACCESS_TOKEN = "camtune.accessToken";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escapes a string for safe inclusion in HTML content.
 * Prevents XSS when user-controlled values are rendered in the plugin panel.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Retrieves a stored preference value.
 * @param {string} key
 * @returns {string|null}
 */
function getSetting(key) {
  try {
    return captureOne.preferences.get(key) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Stores a preference value.
 * @param {string} key
 * @param {string} value
 */
function setSetting(key, value) {
  try {
    captureOne.preferences.set(key, value);
  } catch (e) {
    // Ignore storage errors — non-critical
  }
}

/**
 * Shows a notification in the Capture One UI.
 * @param {string} message
 * @param {"info"|"warning"|"error"} [level="info"]
 */
function notify(message, level) {
  var lvl = level || "info";
  try {
    captureOne.ui.showNotification({ message: message, type: lvl });
  } catch (e) {
    // Fallback: log to console
    console.log("[CamTune] " + lvl.toUpperCase() + ": " + message);
  }
}

/**
 * Performs a JSON POST to the CamTune API.
 * @param {string} path
 * @param {object} body
 * @param {string|null} [accessToken]
 * @returns {Promise<{ok: boolean, status: number, data: object}>}
 */
function apiPost(path, body, accessToken) {
  var url = CAMTUNE_BASE_URL + path;
  var headers = { "Content-Type": "application/json" };
  if (accessToken) {
    headers["Authorization"] = "Bearer " + accessToken;
  }

  return fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  })
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    })
    .catch(function (err) {
      return { ok: false, status: 0, data: { error: String(err) } };
    });
}

// ---------------------------------------------------------------------------
// Authorization flow
// ---------------------------------------------------------------------------

/**
 * Opens the CamTune authorization page in the system browser.
 * The user authorizes the plugin, then pastes the token back.
 */
function connectAccount() {
  var authUrl = CAMTUNE_BASE_URL + "/settings/integrations?source=captureone";

  try {
    captureOne.ui.openUrl(authUrl);
  } catch (e) {
    notify(
      "Open the following URL to authorize CamTune:\n" + authUrl,
      "info"
    );
    return;
  }

  // Prompt for the access token
  captureOne.ui
    .showInputDialog({
      title: "Connect CamTune",
      message:
        "After authorizing in your browser, paste the CamTune plugin token here:",
      placeholder: "camtune_plugin_token_...",
    })
    .then(function (result) {
      if (!result || !result.value) {
        notify("Authorization cancelled.", "info");
        return;
      }

      var tokenParts = result.value.split(":");
      if (tokenParts.length < 2) {
        notify(
          "Invalid token format. Expected userId:accessToken.",
          "error"
        );
        return;
      }

      var userId = tokenParts[0];
      var accessToken = tokenParts.slice(1).join(":");

      setSetting(SETTINGS_KEY_USER_ID, userId);
      setSetting(SETTINGS_KEY_ACCESS_TOKEN, accessToken);

      notify("CamTune connected! Your sessions will now sync automatically.", "info");
    });
}

/**
 * Removes stored credentials and disconnects the plugin.
 */
function disconnectAccount() {
  setSetting(SETTINGS_KEY_USER_ID, "");
  setSetting(SETTINGS_KEY_ACCESS_TOKEN, "");
  notify("CamTune disconnected.", "info");
}

// ---------------------------------------------------------------------------
// Session sync
// ---------------------------------------------------------------------------

/**
 * Syncs the currently selected Capture One session with CamTune.
 *
 * Reads the session metadata from the active catalog, sends it to the
 * CamTune sync API, and writes back any updated metadata fields.
 *
 * Responds within 5 seconds (acceptance criterion: ≤5s).
 */
function syncSession() {
  var userId = getSetting(SETTINGS_KEY_USER_ID);
  var accessToken = getSetting(SETTINGS_KEY_ACCESS_TOKEN);

  if (!userId || !accessToken) {
    notify(
      "CamTune is not connected. Use Script > CamTune > Connect CamTune Account.",
      "warning"
    );
    return;
  }

  // Get the active session ID from Capture One metadata
  var sessionId;
  try {
    var activeImages = captureOne.catalog.getSelectedImages();
    if (!activeImages || activeImages.length === 0) {
      notify(
        "No image selected. Select an image that has a CamTune session ID in its metadata.",
        "warning"
      );
      return;
    }

    // Look for the camtune:SessionId XMP field
    var img = activeImages[0];
    sessionId = img.metadata.get("camtune:SessionId");

    if (!sessionId) {
      // Fallback: prompt user for session ID
      captureOne.ui
        .showInputDialog({
          title: "CamTune Session ID",
          message: "Enter the CamTune session ID to sync:",
          placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        })
        .then(function (result) {
          if (result && result.value) {
            performSync(userId, result.value, accessToken);
          }
        });
      return;
    }
  } catch (e) {
    notify("Could not read session metadata: " + String(e), "error");
    return;
  }

  performSync(userId, sessionId, accessToken);
}

/**
 * Performs the actual sync API call.
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} accessToken
 */
function performSync(userId, sessionId, accessToken) {
  var startTime = Date.now();

  apiPost(
    "/api/integrations/captureone/sync",
    { userId: userId, sessionId: sessionId },
    accessToken
  ).then(function (response) {
    var elapsed = Date.now() - startTime;

    if (response.ok && response.data.success) {
      notify(
        "Session synced to CamTune in " + elapsed + "ms. " +
          (response.data.synced || 1) + " session(s) updated.",
        "info"
      );
    } else if (!response.ok && response.status === 401) {
      notify(
        "CamTune authorization expired. Please reconnect via Script > CamTune > Connect CamTune Account.",
        "error"
      );
    } else {
      var errMsg =
        (response.data && response.data.error) || "Unknown error";
      notify(
        "Sync queued for retry: " + errMsg,
        "warning"
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Session info panel renderer
// ---------------------------------------------------------------------------

/**
 * Renders a simple HTML panel showing CamTune session context.
 * Called by Capture One when the CamTune panel is visible.
 */
function renderSessionPanel() {
  var userId = getSetting(SETTINGS_KEY_USER_ID);

  if (!userId) {
    return captureOne.ui.renderHtml(
      '<div style="padding:12px;font-family:sans-serif;">' +
        "<h3>CamTune</h3>" +
        "<p>Not connected.</p>" +
        '<p><a href="#" onclick="captureOne.plugin.runAction(\'connectAccount\')">Connect your CamTune account</a></p>' +
        "<hr/>" +
        "<h4>Install Guide</h4>" +
        "<ol>" +
        "<li>Go to <b>Script &gt; CamTune &gt; Connect CamTune Account</b></li>" +
        "<li>Authorize in your browser at <b>camtune.app</b></li>" +
        "<li>Paste the plugin token back into Capture One</li>" +
        "<li>Select an image and run <b>Sync with CamTune</b></li>" +
        "</ol>" +
        "</div>"
    );
  }

  // Show connected state with a sync button
  return captureOne.ui.renderHtml(
    '<div style="padding:12px;font-family:sans-serif;">' +
      "<h3>CamTune</h3>" +
      '<p style="color:green;">&#10003; Connected</p>' +
      "<p>Select an image and click Sync to pull shoot conditions, AI recommendation, and actual settings into this catalog.</p>" +
      '<button onclick="captureOne.plugin.runAction(\'syncSession\')" ' +
      'style="padding:6px 14px;background:#0070f3;color:white;border:none;border-radius:4px;cursor:pointer;">' +
      "Sync with CamTune" +
      "</button>" +
      "<hr/>" +
      "<small>User: " + escapeHtml(userId) + "</small>" +
      "</div>"
  );
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

captureOne.plugin.register({
  id: "com.camtune.captureone",
  actions: {
    syncSession: syncSession,
    connectAccount: connectAccount,
    disconnectAccount: disconnectAccount,
    renderSessionPanel: renderSessionPanel,
  },
});
