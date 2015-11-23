function addCLA(value) {
	var args = document.getElementById("args");
	var placeholder = document.getElementById("arg-placeholder");
	var newArgContainer = document.createElement("div");
	var newArg = document.createElement("textarea");
	var newArgRemover = document.createElement("a");

	if (value !== undefined)
		newArg.value = value

	newArgContainer.className = "arg-container";
	newArg.className = "arg";
	newArgRemover.onclick = function() { this.parentNode.remove(); }
	newArgRemover.innerHTML = "&ndash;";
	newArgContainer.appendChild(newArg);
	newArgContainer.appendChild(newArgRemover);
	args.insertBefore(newArgContainer, placeholder);

}

function decode(string) {
	return decodeURIComponent(escape(atob(unescape(string).replace(/-/g, "+").replace(/_/g, "/"))))
}

function encode(string) {
	return btoa(unescape(encodeURIComponent(string))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function encodeArgs() {
	var args = document.getElementsByClassName("arg");
	var argsEncoded = new Array();

	if (!args.length)
		return "";

	for(var i = 0; i < args.length; i++)
		argsEncoded[i] = encode(args[i].value);

	return "&args=" + argsEncoded.join("+");
}

function permalink() {
	var code = document.getElementById("code").value;
	var input = document.getElementById("input").value;
	var args = document.getElementsByClassName("arg");
	var toggles = document.getElementsByClassName("on");
	var params = "code=" + encode(code) + "&input=" + encode(input) + encodeArgs();

	for(var i = 0; i < toggles.length; i++)
		params += "&" + toggles[i].id + "=on";

	location.hash = "#" + params;
}

function toggle(button)
{
	button.className = button.className == "on" ? "off" : "on";
}

function run() {
	var code = document.getElementById("code").value;
	var input = document.getElementById("input").value;
	var args = document.getElementsByClassName("arg");
	var toggles = document.getElementsByClassName("on");
	var data = "code=" + encodeURIComponent(code) + "&input=" + encodeURIComponent(input) + encodeArgs();
	var buttonRun = document.getElementById("run");
	var http = new XMLHttpRequest();
	
	for(var i = 0; i < args.length; i++)
		data += encodeURIComponent(args[i].value) + "+";

	data = data.replace(/\+$/, "");

	for(var i = 0; i < toggles.length; i++)
		data += "&" + toggles[i].id + "=on";

	buttonRun.disabled = true;
	buttonRun.value = "Running\u2026";
	http.open("POST", "/cgi-bin/backend", true);

	http.onreadystatechange = function() {
		if(http.readyState == 4) {
			buttonRun.disabled = false;
			buttonRun.value = "Run";

			if (http.status == 200)
				var output = document.getElementById("output");

				output.value = http.responseText;
				output.style.height = 0;
				output.style.height = output.scrollHeight + "px";
		}
	}

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

		if(element.value)
			element.className = field[1];
		else
			element.value = decode(field[1]);
	}
}
