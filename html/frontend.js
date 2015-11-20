function decode(string) {
	return decodeURIComponent(escape(atob(unescape(string).replace(/-/g, "+").replace(/_/g, "/"))))
}

function encode(string) {
	return btoa(unescape(encodeURIComponent(string))).replace(/\+/g, "-").replace(/\//g, "_")
}

function permalink() {
	var code = document.getElementById("code").value;
	var input = document.getElementById("input").value;
	var params = "code=" + encode(code) + "&input=" + encode(input);

	location.hash = "#" + params;
}

function run() {
	var code = document.getElementById("code").value;
	var input = document.getElementById("input").value;
	var params = "code=" + encodeURI(code) + "&input=" + encodeURI(input);
	var url = "/cgi-bin/backend" + "?" + params;
	var button = document.getElementById("run");
	var http = new XMLHttpRequest();

	button.disabled = true;
	button.value = "Running\u2026";
	http.open("GET", url, true);

	http.onreadystatechange = function() {
		if(http.readyState == 4) {
			button.disabled = false;
			button.value = "Run";

			if (http.status == 200)
				var output = document.getElementById("output");

				output.value = http.responseText;
				output.style.height = 0;
				output.style.height = output.scrollHeight + "px";
		}
	}

	http.send();
}

var fields = location.hash.substring(1).split("&");

for(var i = 0; i < fields.length; i++) {
	var field = fields[i].split("=");

	if (field[1])
		document.getElementById(field[0]).value = decode(field[1]);
}
