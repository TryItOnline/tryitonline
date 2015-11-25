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

function adjust(element) {
	element.style.height = 0;
	element.style.height = element.scrollHeight + "px";
	
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

function run() {
	var data = encodeCode(encodeURIComponent) + encodeInput(encodeURIComponent) + encodeArgs(encodeURIComponent) + encodeToggles();
	var buttonRun = document.getElementById("run");
	var http = new XMLHttpRequest();
	
	buttonRun.onclick =undefined;
	buttonRun.style.cursor = "wait";
	buttonRun.innerHTML = "Running&#x2026;";
	http.open("POST", "/cgi-bin/backend", true);

	http.onreadystatechange = function() {
		if(http.readyState == 4) {
			buttonRun.onclick = run;
			buttonRun.style.cursor = "pointer";
			buttonRun.innerHTML = "&#9881; Run";
		}

		if (http.status == 200) {
			var output = document.getElementById("output");

			output.value = http.responseText;
			adjust(output);
		}
	};

	http.send(data);
}

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

window.onkeyup = function(event) {
	if (event.altKey)
		if (event.keyCode == 82)      // 'r'
			run();
		else if (event.keyCode == 83) // 's'
			permalink();
};
