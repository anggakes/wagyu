var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var apiai = require("apiai");
var appapiai = apiai("e1452f1578e841618bff72af7b01177e");

const request = require('request');

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.use('/assets', express.static('assets'));

// chat
io.on('connection', function(socket){
    socket.on('chat message', function(msg){
        console.log('message: ' + msg);
        // request to dialog flow
        var options = {
            sessionId: 'atomamedical'
        };

        var request = appapiai.textRequest(msg, options);

        request.on('response', function(response) {
            console.log(response);
            socket.emit('chat message', response.result.fulfillment);
        });

        request.on('error', function(error) {
            console.log(error);
        });

        request.end();
    });
    // socket.on('chat message', function(msg){
    //     io.emit('chat message', "wonderful");
    // });
});


// webhook
var bodyParser = require('body-parser');
var rawBodySaver = function (req, res, buf, encoding) {
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
    }
}

app.use(bodyParser.json({ verify: rawBodySaver }));
app.use(bodyParser.urlencoded({ verify: rawBodySaver, extended: true }));
app.use(bodyParser.raw({ verify: rawBodySaver, type: function () { return true } }));

app.use(function(req, res, next) {
    var data = '';
    req.on('data', function(chunk) {
        data += chunk;
    });
    req.on('end', function() {
        req.rawBody = data;
    });
    next();
});

function sendResponse(res, message, data){
    res.setHeader('Content-Type', 'application/json'); //Requires application/json MIME type
    res.send(JSON.stringify(
        {
            "fulfillmentText": message,
            "fulfillmentMessages": [

            ],
            "source": "atomamedical",
            "payload": data,
            "outputContexts": [

            ],
            "followupEventInput": {

            },
        }
        )
    );
}
app.post('/webhook', function(req, res){

    console.log(req.rawBody);
    raw = JSON.parse(req.rawBody);
    data= raw.queryResult;
    var dataResponse = {};


    if(data.action === "tanya.product"){
        let kategori = data.parameters.kategori;

        if(kategori === undefined || kategori === ''){
            sendResponse(res, 'Maaf, produknya tidak dapat maya temukan', {});
        } else{
            let q = data.parameters.kategori;

            q = q.replace(/[^\w\s]/gi, '')

                .replace('obat','')
                . replace('\?', '')
            ;

            if(q !== 'susu') q = q .replace('susu', '');


            q = encodeURIComponent(q);
            let filter = data.parameters.produk_filter;

            request('http://playground.atoma.co.id/prosehat/mobile_api/inbound.php/products?q='+q+"&f="+filter, { json: true }, (err, res1, body) => {
                if (err) { return console.log(err); }
                var dataResponse = {};
                dataResponse.data = body.data;
                if(dataResponse.data.items.length <= 0 ) {
                    sendResponse(res, 'maaf barangnya habis kakak :(', {});
                }else{
                    dataResponse.type = 'cards';
                    sendResponse(res, 'silahkan dipilih kakak :) <br> untuk menambah ke cart ketik :<br> <strong>tambah cart {sku} - {qty}</strong>', dataResponse);

                }
            });
        }

    }else if(data.action === "addtocart"){

        let qty = data.parameters.number !== undefined ? parseInt(data.parameters.number) : 1;
        let pid = data.parameters.sku;

        dataResponse.data = {
            "qty" : qty,
            "pid" : pid
        };
        dataResponse.type = 'addtocard';

        sendResponse(res, 'Baik, Maya akan tambahkan produknya ke cart', dataResponse);

    }else if(data.action === "checkout"){

        let name = data.parameters.name;
        let phone = data.parameters.phone;
        let district = data.parameters.district;
        let city = data.parameters.city;
        let province = data.parameters.province;
        let street = data.parameters.street;

        if(
            name === undefined || name === '' ||
            phone === undefined || phone === '' ||
            district === undefined || district === '' ||
            city === undefined || city === '' ||
            province === undefined || province === ''
        ){
            sendResponse(res, 'Maaf ada data yang kurang..', {});

        }else{

            dataResponse.data = {
                "shipping_name" : name,
                "shipping_phone" : phone,
                "street" : street,
                "city" : city,
                "province" : province,
                "district" : district
            };
            dataResponse.type = 'checkout';

            sendResponse(res, 'Sedang memproses checkout..', dataResponse);



        }




    }


});



http.listen(3000, function(){
    console.log('listening on *:3000');
});