function decode(string) {
	return decodeURIComponent(escape(atob(unescape(string).replace(/-/g, "+").replace(/_/g, "/"))))
}

function encode(string) {
	return btoa(unescape(encodeURIComponent(string))).replace(/\+/g, "-").replace(/\//g, "_")
}

function permalink() {
	var code = document.getElementById("code").value;
	var input = document.getElementById("input").value;
	var toggles = document.getElementsByClassName("on");
	var params = "code=" + encode(code) + "&input=" + encode(input);

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
	var toggles = document.getElementsByClassName("on");
	var data = "code=" + encodeURI(code) + "&input=" + encodeURI(input);
	var buttonRun = document.getElementById("run");
	var http = new XMLHttpRequest();

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

	if (field[1]) {
		var element = document.getElementById(field[0]);

		if(element.value)
			element.className = field[1];
		else
			element.value = decode(field[1]);
	}
}
