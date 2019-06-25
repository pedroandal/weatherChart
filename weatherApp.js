var http = require("http");
var fs = require('fs');
var log = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});

var server = http.createServer(function(request, response) {
    console.log(request.url);

	if(request.url == '/'){
		fs.readFile(__dirname + '/index.html', function (err, data) {
			sendResponse(response, err ? "Ocorreu erro ao ler ficheiro html." : data.toString('utf8'), "text/html");
		});
	} else if(request.url.indexOf("/query/") > -1){
		log.write('\n['+String(new Date())+'] Cidade: '+request.url.substr(7));
		readDataFromPublicAPI(response, request.url.substr(7));
	} else {
		sendResponse(response, "404 - Not Found");
	}
});
server.on('error', function (e) {
	switch(e.code) {
		case 'EADDRINUSE':
		console.log('Endereço em uso.');
		break;

		case 'EACCES':
		console.log('Porto ('+e.port+') em uso ou não tem permissão, tente com outro porto.');
		break;

		default:
		console.log("Erro desconhecido");
	    console.log(e);	
	}
});
server.listen(isNaN(process.argv[2]) ? 80 : parseInt(process.argv[2]));
console.log("Servidor está à escuta.");

function readDataFromPublicAPI(response, cidade){
	http.get("http://www.tempo.pt/peticionBuscador.php?lang=pt&texto="+cidade, function(res) {
		var data='';

	    res.on('data', function(chunk) {
			data += chunk.toString();
		});

		res.on('end', function() {
			var found = false;
			data = JSON.parse(data);

			if(data.status == 0) {
				for(var i=0; i<data.localidad.length; i++){

					//apenas id's das cidades
					if(data.localidad[i] && data.localidad[i].nivel == 4){
						log.write(' || ID: '+data.localidad[i].id);
						getAndDecodeAPIinfo(response, data.localidad[i].id);
						found = true;
						break; //usa apenas a primeira cidade encontrada
					}
				}
			} 

			if(!found) {					
  				sendResponse(response, "{}", "application/json");
			}
		});
	}).on('error', function(e) {
		console.log("Erro ao contactar a API externa.");
		sendResponse(response, "{}", "application/json");
	});
}

function getAndDecodeAPIinfo(response, id) {	
	http.get("http://api.tempo.pt/index.php?api_lang=pt&localidad="+id+"&affiliate_id=ggfmrzdl8354&v=3.0", function(res) {
		var data='';

	    res.on('data', function(chunk) {
			data += chunk.toString();
		});

		res.on('end', function() {
			data = JSON.parse(data);

			var out = data.status == 0 ? {'cidade': data.location, 'tempMin': data.day[1].tempmin, 'tempMax': data.day[1].tempmax, 'horaMin' : data.day[1].sun.in, 'horaMax': data.day[1].sun.out} : {};
			log.write(' || Dados: '+JSON.stringify(out));

			sendResponse(response, out, "application/json");
		});
	}).on('error', function(e) {
		console.log("Erro ao obter dados da API externa.");
		sendResponse(response, "{}", "application/json");
	});
}

function sendResponse(response, data, type) {
	response.writeHead(200, {"Content-Type": type});
	response.write(typeof data != "string" ? JSON.stringify(data) : data);
	response.end();
}
