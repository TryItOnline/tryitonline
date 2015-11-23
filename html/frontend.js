var cp437 = "␀☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■⍽";

function addCLA(value) {
	var args = document.getElementById("args");
	var newArgContainer = document.createElement("div");
	var newArg = document.createElement("textarea");
	var newArgRemover = document.createElement("a");

	if (value !== undefined)
		newArg.value = value

	newArgContainer.className = "arg-container";
	newArg.className = "arg";
	newArgRemover.onclick = function() { this.parentNode.remove(); };
	newArgRemover.innerHTML = "&#x2796;";
	newArgContainer.appendChild(newArg);
	newArgContainer.appendChild(newArgRemover);
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

function toggle(button)
{
	button.className = button.className == "on" ? "off" : "on";
}

function toggleInput()
{
	var toggle = document.getElementById("inputToggle");
	var input = document.getElementById("input");

	if (toggle.innerText == "\u2795") {
		input.style.visibility = "visible";
		input.style.height = "15%";
		toggle.innerHTML = "&#x274c;"
	} else {
		input.style.visibility = "hidden";
		input.style.height = "5%";
		toggle.innerHTML = "&#x2795;";
		
	}
}

function run() {
	var data = encodeCode(encodeURIComponent) + encodeInput(encodeURIComponent) + encodeArgs(encodeURIComponent) + encodeToggles();
	var buttonRun = document.getElementById("run");
	var http = new XMLHttpRequest();
	
	buttonRun.disabled = true;
	buttonRun.value = "Running\u2026";
	http.open("POST", "/cgi-bin/backend", true);

	http.onreadystatechange = function() {
		if(http.readyState == 4) {
			buttonRun.disabled = false;
			buttonRun.value = "Run";

			if (http.status == 200) {
				var output = document.getElementById("output");

				output.value = http.responseText;
				adjust(output);
			}
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

		if(element.value)
			element.className = field[1];
		else
			element.value = decode(field[1]);
	}
}

window.onkeyup = function(event) {
	if (event.altKey)
		if (event.keyCode == 82)      // 'r'
			run();
};
