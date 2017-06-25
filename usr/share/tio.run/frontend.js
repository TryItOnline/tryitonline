var authKeyURL = "/cgi-bin/static/${tio_cgi_bin_auth}";
var baseTitle = document.title;
var baseURL = $("[rel=canonical]").href;
var bodyWidth = document.body.clientWidth;
var cacheURL = "/cgi-bin/static/${tio_cgi_bin_cache}";
var fieldSeparator = "\xff";
var greeted = "65a4609a"
var languageId;
var languages;
var ms = window.MSInputMethodContext !== undefined;
var quitURL = "/cgi-bin/static/${tio_cgi_bin_quit}";
var rawOutput;
var rExtraFieldStrings = /\xfe[\x00-\xf3\xff]+/g;
var rEscapees = /[\x00-\x09\x0b-\x1f\x7f-\x9f&<>]| $/gm;
var rFieldString = /^[\x00-\xf3\xff]+/;
var rNewLine = /^/gm;
var rLineOfSpaces = /^\s+$/m;
var rSettingString = /\xf5[\x20-\x7e]+/;
var rSurroundingLinefeed = /^\n|\n$/;
var rUnpairedSurrogates = /[\ud800-\udbff](?![\udc00-\udfff])|([^\ud800-\udbff]|^)[\udc00-\udfff]/;
var rUnicodeCharacters = /[^][\udc00-\udfff]?/g;
var rUnprintable = /[\x00-\x09\x0b-\x1f\x7f-\x9f]/;
var rXxdLastLine = /(\w+):(.*?)\s\s.*$/;
var runRequest;
var runURL = "/cgi-bin/static/${tio_cgi_bin_run}";
var startOfExtraFields = "\xfe";
var startOfSettings = "\xf5";
var touchDevice = navigator.MaxTouchPoints > 0 || window.ontouchstart !== undefined;
var token;

function $(selector, parent) {
	return (parent || document).querySelector(selector);
}

function $$(selector, parent) {
	return (parent || document).querySelectorAll(selector);
}

function iterate(iterable, monad) {
	if (!iterable)
		return;
	for (var i = 0; i < iterable.length; i++)
		monad(iterable[i]);
}

function deflate(byteString) {
	return pako.deflateRaw(byteStringToByteArray(byteString), {"level": 9});
}

function inflate(byteString) {
	return byteArrayToByteString(pako.inflateRaw(byteString));
}

function sendMessage(title, text) {
	var message = clone("#templates > .message");

	$("h4", message).textContent = title;
	$("div", message).textContent = text;
	$("#messages").appendChild(message);
}

function resize(textArea) {
	var dummy = $("#dummy");
	textArea = this == window ? textArea : this;
	dummy.style.fontFamily = getComputedStyle(textArea).fontFamily;
	dummy.style.width = getComputedStyle(textArea).width;
	dummy.value = textArea.value;
	textArea.style.height = Math.max(dummy.scrollHeight, textArea.dataset.baseHeight || 27) + "px";
}

function addField(element) {
	var cla = $("#templates .array").cloneNode(deep = true);
	var textArea = $("textarea", cla);
	var parent = element.parentNode;
	parent.parentNode.insertBefore(cla, parent);
	textArea.onfocus = textArea.oninput = resize;
	if (!touchDevice)
		textArea.focus();
	return cla;
}

function byteStringToByteArray(byteString) {
	var byteArray = new Uint8Array(byteString.length);
	for(var index = 0; index < byteString.length; index++)
		byteArray[index] = byteString.charCodeAt(index);
	byteArray.head = 0;
	return byteArray;
}

function textToByteString(string) {
	return unescape(encodeURIComponent(string));
}

function byteStringToText(byteString) {
	return decodeURIComponent(escape(byteString));
}

function stateToByteString() {
	var retval = "";
	$("#real-code").value = ($("#header").value && $("#header").value + "\n") + $("#code").value + ($("#footer").value && "\n" + $("#footer").value);
	iterate($$("[data-type]"), function(element) {
		if (element.parentNode.dataset.mask === "true")
			return;
		var type = element.dataset.type;
		retval += type;
		if (type == "R")
			return;
		retval += element.dataset.name + "\0";
		if (type == "F") {
			var value = textToByteString(element.value);
			retval += value.length + "\0" + value;
		}
		if (type == "V") {
			var subelements = $$("[value]", element);
			retval += subelements.length + "\0";
			iterate(subelements, function(subelement) {
				retval += textToByteString(subelement.value) + "\0";
			});
		}
	});
	return retval;
}

function runRequestOnReadyState() {
	if (runRequest.readyState != XMLHttpRequest.DONE)
		return;

	$("#run").classList.remove("running");

	var response = byteArrayToByteString(new Uint8Array(runRequest.response));
	var statusCode = runRequest.status;
	var statusText = runRequest.statusText;

	runRequest = undefined;
	cacheHit = statusCode == 203;

	if (statusCode == 204)
		return;

	if (statusCode >= 400) {
		sendMessage("Error " + statusCode, statusCode < 500 ? response || statusText : statusText);
		return;
	}

	try {
		var rawOutput = inflate(response.slice(10));
	} catch(error) {
		sendMessage("Error", "The server's response could not be decoded.");
		return;
	}

	try {
		response = byteStringToText(rawOutput);
	} catch(error) {
		response = rawOutput;
	}

	if (response.length < 32) {
		if (cacheHit)
			$("#run").onclick("no-cache");
		else
			sendMessage("Error", "Could not establish or maintain a connection with the server.");
		return;
	}

	var results = response.substr(16).split(response.substr(0, 16));
	var warnings = results.pop().split("\n");
	var outputTextAreas = $$("#interpreter textarea.output");

	iterate(warnings, function(warning) {
		if (warning !== "") {
			if (results.toString() !== "")
				sendMessage("Warning", warning);
			else {
				if (cacheHit)
					cacheHit = $("#run").onclick("no-cache");
				else
					sendMessage("Error", warning);
			}
		}
	});

	if (cacheHit)
		$("#cache-notice").classList.remove("hidden");
	else
		$("#cache-notice").classList.add("hidden");

	iterate(outputTextAreas, function(outputTextArea) {
		outputTextArea.value = results.shift() || "";
		resize(outputTextArea);
	});
}

function byteArrayToByteString(byteArray) {
	var retval = "";
	iterate(byteArray, function(byte) { retval += String.fromCharCode(byte); });
	return retval;
}

function byteStringToBase64(byteString) {
	return btoa(byteString).replace(/\+/g, "@").replace(/=+/, "");
}

function base64ToByteString(base64String) {
	return atob(unescape(base64String).replace(/@|-/g, "+").replace(/_/g, "/"))
}

function pluralization(number, string) {
	return number + " " + string + (number == 1 ? "" : "s");
}

function byteStringToTextArea(byteString, textArea) {
	textArea.value = byteStringToText(byteString);
	resize(textArea);
}

function fieldArrayToState(fieldArray, target, decoder) {
	iterate(fieldArray, function(field) {
		byteStringToTextArea(decoder ? decoder(field) : field, $("textarea", addField($(".array-tail", target))))
	});
}

function removeArrays() {
	iterate($$(".array-remove", $("#interpreter")), function(element) { element.click(); });
}

function hashToState(hash) {
	if (/=/.test(hash)) {
		removeArrays();
		var hashArray = hash.split("#");
		languageId = hashArray[0];
		var fields = hashArray[1].split("&");
		for (var i = 0; i < fields.length; i++) {
			var field = fields[i].split("=");
			if (field[0] == "args")	{
				fieldArrayToState(field[1].split("+"), $("#cla-wrapper"), base64ToByteString);
				continue;
			}
			if (field[1]) {
				var element = $("#" + field[0]);
				if (element === null)
					continue;
				byteStringToTextArea(base64ToByteString(field[1]), element);
			}
		}
	} else {
		try {
			var hashArray = hash.split("#");
			var stateString = (hashArray[0]) ? hashArray[0] + fieldSeparator : "";
			stateString += hashArray[1] && inflate(base64ToByteString(hashArray[1]));
			var fieldArray = stateString.match(rFieldString)[0].split(fieldSeparator);
			languageId = fieldArray.shift().toLowerCase();
			var extraFieldStrings = stateString.match(rExtraFieldStrings);
			var settingString = (stateString.match(rSettingString) || [""])[0].slice(1);
			if (fieldArray.length < 4)
				return;
			removeArrays();
			byteStringToTextArea(fieldArray[0], $("#header"));
			byteStringToTextArea(fieldArray[1], $("#code"));
			byteStringToTextArea(fieldArray[2], $("#footer"));
			byteStringToTextArea(fieldArray[3], $("#input"));
			fieldArrayToState(fieldArray.slice(4), $("#cla-wrapper"));
			if (extraFieldStrings)
				iterate(extraFieldStrings, function(fieldString) {
					var fieldArray = fieldString.slice(1).split(fieldSeparator);
					var target = $("[data-if*=" + fieldArray.shift() + "]");
					$("input[type=checkbox]", target).checked = true;
					fieldArrayToState(fieldArray, target)
				});
			if (settingString) {
				$("#toggle-settings").checked = true;
				iterate(settingString.split("/"), function(setting) {
					$("input[id^=toggle][value=" + setting + "]").checked = true;
				});
			}
		} catch(error) {
			console.error(error);
			sendMessage("Error", "The permalink could not be decoded.");
			return;
		}
	}
}

function countBytes(string, encoding) {
	if (string === "")
		return 0;
	if (encoding == "SBCS")
		return string.match(rUnicodeCharacters).length;
	if (encoding == "UTF-8")
		return textToByteString(string).length;
	if (encoding == "xxd") {
		var fields = string.match(rXxdLastLine);
		if (!fields)
			return 0;
		return Number("0x" + fields[1]) + fields[2].match(/\S\S/g).length;
	}

}

function init() {
	var compatibility, keepHash;
	document.title = baseTitle;
	$("#toggle-index").checked = true;
	$("#toggle-home").checked = false;
	$("#toggle-permalink").checked = false;
	$("#toggle-community").checked = false;
	if (/^.nexus/.test(location.pathname))
		history.replaceState({}, "", location.href.replace(/nexus.?/, "#"));
	if (location.hash === "" && localStorage.getItem("greeted") !== greeted)
		location.hash = "#home";
	var hash = unescape(location.hash.slice(1));
	if (hash === "home") {
		localStorage.setItem("greeted", greeted);
		$("#toggle-home").checked = true;
	}
	else if (hash === "community")
		$("#toggle-community").checked = true;
	else if (/^(get-started)?$/.test(hash) == false) {
		hashToState(hash);
		if (languageId === "perl") {
			languageId = "perl5";
			compatibility = function() {
				var clas = $("#cla-wrapper");
				var options = $("#option-wrapper");
				iterate($$(".array:not(:last-child)", clas), function(argument) {
					options.insertBefore(clas.removeChild(argument), $(".array:last-child", options));
				});
				$("#toggle-options").checked = $("#toggle-arguments").checked;
				$("#toggle-arguments").checked = false;
				saveState();
			}
		}
		var language = languages[languageId];
		if (languageId && !language) {
			$("#toggle-index").checked = true;
			sendMessage("Error", "The requested language could not be found. This may be due to caching; try a hard refresh.");
			languageId = undefined;
			return;
		}
		$("#toggle-interpreter").checked = true;
		iterate($$("[data-if]"), function(element) {
			element.dataset.mask = (!language.unmask || language.unmask.indexOf(element.dataset.if) < 0);
		});
		$("#toggle-header").checked    = $("#header").value         !== "";
		$("#toggle-footer").checked    = $("#footer").value         !== "";
		$("#toggle-input").checked     = $("#input").value          !== "";
		$("#toggle-arguments").checked = $("#cla-wrapper textarea") !== null;
		document.title = language.name + " – " + baseTitle;
		$("#lang-id").value = languageId;
		$("#lang-link").href = language.link;
		$("#lang-name").textContent = language.name;
		$("#code").oninput();
		if (!touchDevice)
			setTimeout(function() { $("#code").focus(); }, 10);
		if (typeof compatibility === "function")
			compatibility();
		if (/#/.test(hash))
			probeOutputCache();
		keepHash = true;
	}
	scrollTo(0, 0);
	$("nav").classList.remove("hidden");
	if (!keepHash)
		history.pushState({}, "", "#");
}

function switchLanguages() {
	if (this.id == "lang-switch")
		history.pushState({}, "", "/#get-started");
	else {
		languageId = this.dataset.id;
		history.pushState({}, "", "#" + languageId);
	}
	init();
}

function clone(queryString) {
	return $(queryString).cloneNode(true)
}

function copyToClipboard() {
	$("textarea", this.parentNode.parentNode).select();
	document.execCommand("copy");
}

function codeToMarkdown(code) {
	if (code === "")
		return "<pre><code></code></pre>";
	if (rLineOfSpaces.test(code) || rSurroundingLinefeed.test(code) || rUnprintable.test(code))
		return "<pre><code>" + code.replace(rEscapees, function(character) {
			switch (character) {
				case "\0": return "";
				case "<":  return "&lt;";
				case ">":  return "&gt;";
				case "&":  return "&amp;";
				default:   return "&#" + character.charCodeAt(0) + ";";
			}
		}) + "\n</code></pre>";
	else
		return code.replace(rNewLine, "    ");
}

function getSettings(arguments) {
	var retval = "/";
	var settings = $$("#settings input:checked");
	iterate(arguments, function(argument) { retval += (typeof argument === "string") ? argument + "/" : ""; })
	iterate(settings, function(element) { retval += element.value + "/"; })
	return retval;
}

function saveState() {
	if (!languageId)
		return;
	var stateString = languageId;
	var saveTextArea = function(textArea) {
		if (textArea.readOnly)
			return;
		stateString += fieldSeparator + textToByteString(textArea.value);
	}
	iterate($$("#interpreter > textarea, #interpreter > :not([data-mask]) textarea"), saveTextArea);
	iterate($$("#interpreter > [data-mask=false]"), function(element) {
		if ($("textarea", element) === null)
			return;
		stateString += startOfExtraFields + (element.dataset.if || element.dataset.ifNot);
		iterate($$("textarea", element), saveTextArea);
	});
	var settings = getSettings();
	if (settings != "/")
		stateString += startOfSettings + settings.slice(1,-1);
	history.pushState({}, "", "##" + byteStringToBase64(byteArrayToByteString(deflate(stateString))));
}

function bufferToHex(buffer) {
	var dataView = new DataView(buffer);
	var retval = "";

	for (var i = 0; i < dataView.byteLength; i++)
		retval += (256 | dataView.getUint8(i)).toString(16).slice(-2);

	return retval;
}

function getRandomBits(minBits) {
	var crypto = window.crypto || window.msCrypto;
	return bufferToHex(crypto.getRandomValues(new Uint8Array(minBits + 7 >> 3)).buffer);
}

function sha256(byteArray, callback) {
	if (window.crypto)
		return (crypto.subtle || crypto.webkitSubtle).
			digest("SHA-256", byteArray).
			then(bufferToHex).
			then(callback);

	if (byteArray.length == 0)
		return callback('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

	var operation = msCrypto.subtle.digest("SHA-256");
	operation.process(byteArray);
	operation.oncomplete = function(event) {
		callback(bufferToHex(event.target.result));
	};
	operation.finish();
}

function probeOutputCache() {
	runRequest = new XMLHttpRequest;
	runRequest.open("POST", cacheURL, true);
	runRequest.responseType = "arraybuffer";
	runRequest.onreadystatechange = runRequestOnReadyState;
	sha256(deflate(stateToByteString()), runRequest.send.bind(runRequest));
}

function onAuthorization() {
	removeEventListener("storage", onAuthorization);
	var auth_name = localStorage.getItem("name")
	if (auth_name)
		sendMessage("Authorization successful", "Welcome, " + auth_name + ".");
	else
		sendMessage("Authorization failed", "Please try again or email support@tryitonline.net.");
}

function getAuthKey() {
	var state = getRandomBits(128);
	document.cookie = "nonce=" + state + "; Path=/cgi-bin; Secure";
	addEventListener("storage", onAuthorization);
	open(authKeyURL + "&state=" + state);
}

function boot() {
	languages = JSON.parse(languageFileRequest.response);
	var languageArray = [];
	var languageCounts = {all: 0, practical: 0, recreational: 0};

	for (var id in languages) {
		var language = languages[id];
		language.id = id;
		languageArray.push(language);
	}

	languageArray.sort(function(languageA, languageB) {
		return 2 * (languageA.name.toLowerCase() > languageB.name.toLowerCase()) - 1;
	});

	iterate(languageArray, function(language) {
		var item = document.createElement("div");
		item.appendChild(document.createTextNode(language.name));
		item.dataset.id = language.id;
		item.title = language.name;
		item.onclick = switchLanguages;
		iterate(language.categories, function(category) {
			$("#list-" + category).append(item);
			languageCounts[category] += 1;
		});
		languageCounts.all += 1;
	});

	iterate(["practical", "recreational", "all"], function(category) {
		var count = languageCounts[category];
		var counter = $("#count-" + category);
		if (counter !== null) {
			counter.textContent = pluralization(count, "language");
			counter.title = pluralization(count, category + " programming language");
		}
		$("#langcount-" + category).textContent = count;
	});

	if (ms)
		$("#run").classList.add("ms");

	var fieldToggles = $$("h3 label span");

	for (var i = 0; i < fieldToggles.length; i++) {
		var element = fieldToggles[i];
		var svg = clone("#templates > .bullet");
		element.parentNode.insertBefore(svg, element);
	}

	var copyEntries = $$(".copy-entry")
		for (var i = 0; i < copyEntries.length; i++) {
			var copyEntry = copyEntries[i];
			var copyButton = $(".copy-button", copyEntry);
			copyButton.title = "Copy to clipboard and close the drawer."
			copyButton.onclick = copyToClipboard;
			copyButton.appendChild(clone("#templates .copy-icon"));
		}

	var textAreas = $$("textarea:not([id=dummy])");
	for (var i = 0; i < textAreas.length; i++) {
		var textArea = textAreas[i];
		textArea.spellcheck = false;
		textArea.onfocus = textArea.oninput = resize;
		textArea.setAttribute("autocapitalize", "none");
		textArea.setAttribute("autocorrect", "off");
		resize(textArea);
	}

	addEventListener("resize", function() {
		if (document.body.clientWidth == bodyWidth)
			return;
		bodyWidth = document.body.clientWidth;
		var textAreas = $$("#interpreter textarea");
		for (var i = 0; i < textAreas.length; i++)
			resize(textAreas[i]);
	});

	$("#run").onclick = function() {
		if (runRequest) {
			var quitRequest = new XMLHttpRequest;
			quitRequest.open("GET", quitURL + "/" + token);
			quitRequest.send();
			return;
		}
		$("#run").classList.add("running");
		token = getRandomBits(128);
		runRequest = new XMLHttpRequest;
		runRequest.open("POST", runURL + getSettings(arguments) + token, true);
		runRequest.responseType = "arraybuffer";
		runRequest.onreadystatechange = runRequestOnReadyState;
		runRequest.send(deflate(stateToByteString()));
	}

	$("#permalink").onclick = function() {
		var code = $("#code").value;
		var language = languages[languageId];
		saveState();
		var data = {
			"bytes": pluralization(countBytes(code, language.encoding), "byte"),
			"markdownCode": codeToMarkdown(code),
			"prettifyHint": language.prettify ? "<!-- language-all: lang-" + language.prettify + " -->\n\n" : "",
			"lang": language.name,
			"link": language.link,
			"n": "\n",
			"nn": "\n\n",
			"permalink": location.href,
			"timestamp": Date.now().toString(36)
		}
		var textAreas = $$("#permalink-drawer textarea");
		for (var i = 0; i < textAreas.length; i++) {
			var textArea = textAreas[i];
			textArea.style.height = textArea.dataset.baseHeight + "px";
			textArea.value = textArea.dataset.format.replace(/\{\{(\w*)\}\}/g, function(_, match) {
				return data[match];
			});
		}
	};

	$("#lang-switch").onclick = switchLanguages;

	iterate($$("span[data-message]"), function(element) {
		element.onclick = function() { sendMessage(element.dataset.messageTitle, element.dataset.message); };
	});

	$("#code").oninput = function()	{
		var code = $("#code").value;
		var encoding = languages[languageId].encoding;

		resize($("#code"));

		if (rUnpairedSurrogates.test(code))
			return $("#code-info").textContent = "invalid Unicode: unpaired surrogates";

		var characterCount = countBytes(code, "SBCS");
		var byteCount = countBytes(code, encoding);

		$("#code-info").textContent  = pluralization(characterCount, "char");
		$("#code-info").textContent += ", " + pluralization(byteCount, "byte") + " (" + encoding + ")";
	}

	function modifiers(event) {
		return event.altKey << 3 | event.ctrlKey << 2 | event.metaKey << 1 | event.shiftKey;
	}

	function typeString(string) {
		var element = document.activeElement;
		if (element.selectionStart === undefined)
			return;
		var start = element.selectionStart;
		var end = element.selectionEnd;
		element.value = element.value.slice(0, start) + string + element.value.slice(end);
		element.selectionStart = start + string.length;
		element.selectionEnd = element.selectionStart;
		element.oninput();
	}

	function advanceFocus() {
		var focused = $("textarea:focus");
		var focusable = $$("input:checked + h3 + textarea, input:checked + h3 + div textarea");
		if (focused == null)
			return;
		else {
			for (var index = 0; focusable[index] != focused && index < focusable .length; index++);
			focusable[(index + 1) % focusable.length].focus();
		}
	}

	addEventListener("popstate", init);
	addEventListener("beforeunload", saveState);

	addEventListener("keydown", function(event) {
		if (modifiers(event) == 0 && event.keyCode == 27) {
			if ("ActiveXObject" in window)
				event.preventDefault();
			if ($("#toggle-home").checked == false)
				$("body").classList.toggle("command-mode");
		}
		else if ($("body").classList.contains("command-mode")) {
			event.preventDefault();
			var key = String.fromCharCode(event.keyCode & 95);
			var element = "A" <= key && key <= "Z" && $("[data-hotkey=" + key + "]");
			if (modifiers(event))
				return;
			if (element && element.offsetParent !== null) {
				if (element !== $("#permalink") || $("#toggle-permalink").checked)
					$("body").classList.remove("command-mode");
				if (ms && key == "R")
					setTimeout(function(){ element.click(); }, 100);
				else
					element.click();
			}
		}
		else if (modifiers(event) == 0 && event.keyCode == 9) {
			event.preventDefault();
			typeString("\t", event);
		}
		else if (modifiers(event) == 1 && event.keyCode == 9) {
				event.preventDefault();
				advanceFocus();
		}
		else if (modifiers(event) == 4 && event.keyCode == 13)
			$("#run").click();

	});
	init();
}

var languageFileRequest = new XMLHttpRequest;
languageFileRequest.onreadystatechange = function() {
	try {
		if (languageFileRequest.readyState != XMLHttpRequest.DONE)
			return;

		sha256(byteStringToByteArray(getRandomBits(128)), String);
		boot();
	} catch(error) {
		console.error(error);

		if (error instanceof ReferenceError)
			sendMessage("Error", "Some resources could not be loaded. Please refresh the page and try again.");
		else
			alert("Your browser seems to lack a required feature.\n\nCurrently, the only supported browser are Chrome/Chromium, Firefox, and Safari (recent versions), Edge (all versions), and Internet Explorer 11.\n\nIf you are using one of those browsers, you are receiving this message in error. Please send an email to feedback@tryitonline.net and include the error log below. You should be able to copy the error message from your console.\n\n"	+ error);
	}
}
languageFileRequest.open("GET", "/static/${tio_languages_json}");
languageFileRequest.send();
