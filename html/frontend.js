function addCLA(value) {
	var args = document.getElementById("args");
	var newArgContainer = document.createElement("div");
	var newArgRemover = document.createElement("a");
	var newArg = document.createElement("textarea");

	if (value !== undefined)
		newArg.value = value

	newArgContainer.className = "arg-container";
	newArg.className = "arg";
	newArg.autocapitalize = "off";
	newArg.spellcheck = false;
	newArgRemover.className = "icon";
	newArgRemover.onclick = function() { this.parentNode.remove(); };
	newArgRemover.innerHTML = "&#x2796;";
	newArgRemover.title = "Remove this command-line argument.";
	newArgContainer.appendChild(newArgRemover);
	newArgContainer.appendChild(document.createTextNode(" "));
	newArgContainer.appendChild(newArg);
	args.appendChild(newArgContainer);
}

function countChars() {
	var count = document.getElementById('code').value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 1).length;

	document.getElementById('char-count').innerHTML = '(' + count + ' character' + ( count == 1 ? ')' : 's)' );
}

function decode(string) {
	return decodeURIComponent(escape(atob(unescape(string).replace(/-/g, "+").replace(/_/g, "/"))))
}

function encode(string) {
	return btoa(unescape(encodeURIComponent(string))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function encodeArgs(encoding) {
	var args = document.getElementsByClassName("arg");
	var argsEncoded = new Array();

	if (!args.length)
		return "";

	for(var i = 0; i < args.length; i++)
		argsEncoded[i] = encoding(args[i].value);

	return "&args=" + argsEncoded.join("+");
}

function encodeCode(encoding) {
	var code = document.getElementById("code");

	return "code=" + encoding(code.value);
}

function encodeInput(encoding) {
	var input = document.getElementById("input");

	return "&input=" + encoding(input.value);
}

function encodeToggles() {
	var toggles = document.getElementsByClassName("on");
	var retVal = "";
	
	for(var i = 0; i < toggles.length; i++)
		retVal += "&" + toggles[i].id + "=on";

	return retVal;
}

function permalink() {
	var params = encodeCode(encode) + encodeInput(encode) + encodeArgs(encode) + encodeToggles();

	location.hash = "#" + params;
}

function toggleDebug() {
	var debug = document.getElementById("debug");

	if (debug.className == "button off") {
		debug.className = "button on";
		debug.innerHTML = "&#x2714; Debug";
	} else {
		debug.className = "button off";
		debug.innerHTML = "&#x2718; Debug";
	}
}

function toggleInput()
{
	var toggle = document.getElementById("inputToggle");
	var input = document.getElementById("input");

	if (input.style.display == "inline-block") {
		input.style.display = "none";
		toggle.innerHTML = "&#x270e;";
	} else {
		input.style.display = "inline-block";
		toggle.innerHTML = "&#x270f;"
	}
}

function kill() {
	var http = new XMLHttpRequest();

	http.open("POST", "/cgi-bin/kill", true);
	http.send(uuid);
}

function updateOutput(text) {
	var output = document.getElementById("output");

	output.value = text;
	output.style.height = 0;
	output.style.height = output.scrollHeight + "px";
}

function run() {
	var data = encodeCode(encodeURIComponent) + encodeInput(encodeURIComponent) + encodeArgs(encodeURIComponent) + encodeToggles();
	var buttonRun = document.getElementById("run");
	var http = new XMLHttpRequest();
	
	buttonRun.onclick = null;
	buttonRun.style.cursor = "wait";
	buttonRun.innerHTML = "Connecting&#x2026;";
	updateOutput("");
	http.open("POST", "/cgi-bin/backend", true);

	http.onreadystatechange = function() {
		if (!buttonRun.onclick && http.responseText.length > 32) {
			uuid = http.responseText.substr(0, 32);
			buttonRun.onclick = kill;
			buttonRun.style.cursor = "pointer";
			buttonRun.innerHTML = "&#x2620; Kill";
		}

		if (http.status == 200)
			updateOutput(http.responseText.substr(33));

		if (http.readyState == 4) {
			buttonRun.onclick = run;
			buttonRun.style.cursor = "pointer";
			buttonRun.innerHTML = "&#x2699; Run";
		}
	};

	http.send(data);
}

var uuid;

var fields = location.hash.substring(1).split("&");

for(var i = 0; i < fields.length; i++) {
	var field = fields[i].split("=");

	if (field[0] == "args")	{
		var args = field[1].split("+");

		for(var j = 0; j < args.length; j++)
			addCLA(decode(args[j]))

		continue;
	}

	if (field[1]) {
		var element = document.getElementById(field[0]);

		if (field[0] == "input")
			toggleInput();

		if (field[0] == "debug")
			toggleDebug();
		else
			element.value = decode(field[1]);
	}
}

//from https://github.com/zenorocha/clipboard.js/blob/master/src/clipboard-action.js
function copy (string) {
	var textarea = document.createElement('textarea');
	textarea.style.fontSize = '12pt';
	textarea.style.border = '0';
	textarea.style.padding = '0';
	textarea.style.margin = '0';
	textarea.style.right = '-9999px';
	textarea.style.top = (window.pageYOffset || document.documentElement.scrollTop) + 'px';
	textarea.setAttribute('readonly', '');
	textarea.value = string;
	document.body.appendChild(textarea);
	//from https://github.com/zenorocha/select/blob/master/src/select.js
	textarea.focus();
	textarea.setSelectionRange(0, textarea.value.length);
	document.execCommand('copy');
	document.body.removeChild(textarea);
}

var snippet = (function () {
	var custom = {'Jelly':1,'Seriously':1,'GS2':1,'05AB1E':1,'2sable':1,'M':1};
	return function () {
		permalink();
		var language = document.getElementById("lang").innerText,
			languageLink = document.getElementById("lang").href,
			code = document.getElementById("code").value,
			codeLength = (custom[language] ? code : unescape(encodeURIComponent(code))).length;

		return "# [" + language + "](" + languageLink + "), " +
			codeLength + " byte" + (codeLength == 1 ? "" : "s") +
			"\n\n" + code.replace(/^/gm, '    ') + "\n\n[Try it online!](" + window.location.href + ")";
	}
})();

countChars();
document.getElementById('code').oninput = countChars;

window.onkeyup = function(event) {
	if (event.altKey && !event.ctrlKey && !event.shiftKey) {
		if (event.keyCode == 82)      // 'r'
			document.getElementById("run").click();
		else if (event.keyCode == 83) // 's'
			permalink();
		else if (event.keyCode == 67) // 'c'
			copy(snippet());
	}
	else if (event.ctrlKey && !event.altKey && !event.shiftKey)
		if (event.keyCode == 13)      // Enter
			document.getElementById("run").click();
};
