new function () {
    var ws = null;
    var connected = false;
    var options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
    var serverUrl;

    var connectionStatus;
    var transactionId = 0;
    var connectButton;
    var disconnectButton;
    var pluginButton = $('#pluginButton');
    var startButton = $('#startButton');
    var stopButton = $('#stopButton');

    var lastMessage = [];

    var AuthorizeMessage = [2, "89760432", "MopAuthorize", { "idTag": "", "cpId":"", "connId":"", "vehId":"" }];

    var startTrasaction = [2, "5362373", "MopStartTransaction", {"idTag":"","connId":""}];

    var stopTrasaction = [2, "53628776", "MopStopTransaction", {"idTag":"","transactionId":"", "reason":""}];

    var open = function () {
        var url = serverUrl.val();
        ws = new WebSocket(url);
        ws.onopen = onOpen;
        ws.onclose = onClose;
        ws.onmessage = onMessage;
        ws.onerror = onError;

        connectionStatus.text('OPENING ...');
        serverUrl.attr('disabled', 'disabled');
        connectButton.hide();
        disconnectButton.show();
    }

    var close = function () {
        if (ws) {
            console.log('CLOSING ...');
            ws.close();
        }
        connected = false;
        connectionStatus.text('CLOSED');

        serverUrl.removeAttr('disabled');
        connectButton.show();
        disconnectButton.hide();
        pluginButton.attr('disabled', 'disabled');
        startButton.attr('disabled', 'disabled');
        stopButton.attr('disabled', 'disabled');
    }

    var clearLog = function () {
        $('#messages').html('');
    }

    var onOpen = function () {
        clearLog();
        console.log('OPENED: ' + serverUrl.val());
        connected = true;
        connectionStatus.text('OPENED');

        setTimeout(() => { authorizeUser(); }, 4000);
    };

    var onClose = function () {
        console.log('CLOSED: ' + serverUrl.val());
        ws = null;
        clearInterval(timerId);
        clearInterval(mTimerId);
    };

    var onMessage = function (event) {
        var data = event.data;
        addMessage(data);
        var parsedData = JSON.parse(data);
        if (parsedData[0] == 3) {
            if (parsedData[1] == lastMessage[lastMessage.length - 1].uid) {
                switch (lastMessage[lastMessage.length - 1].action) {
                    case 'MopAuthorize': verifyAuthorize(parsedData[2]);
                    break;
                    case 'MopStartTransaction': verifyStartTransaction(parsedData[2]);
                    break;
                    case 'MopStopTransaction': verifyStopTransaction(parsedData[2]);
                    break;
                }
            }
        }
        else if (parsedData[0] == 2) {
            switch (parsedData[2]) {
                case 'CmsStatusNotification': verifyStatus(parsedData);
                break;
                case 'CmsMeterValuesNotification': meter_value_notification(parsedData);
                break;
            }
        }
        console.log("lastMessage", lastMessage);
    };

    var onError = function (event) {
        alert(event.data);
        close();
    }

    var addMessage = function (data, type) {
        var msg = $('<pre>').text(new Date().toLocaleDateString("en-IN", options) + " - " + data);
        if (type === 'SENT') {
            msg.addClass('sent');
        }
        var messages = $('#messages');
        messages.append(msg);

        var msgBox = messages.get(0);
        while (msgBox.childNodes.length > 1000) {
            msgBox.removeChild(msgBox.firstChild);
        }
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    var authorizeUser = function(){
        var idTag = $('#idTag').val();
        var cpId = $('#cpId').val();
        if(cpId && idTag){
            AuthorizeMessage[3].idTag = idTag;
            AuthorizeMessage[3].cpId = cpId;
            var obj = { uid: AuthorizeMessage[1], action: AuthorizeMessage[2] };
            lastMessage.push(obj);
            addMessage(JSON.stringify(AuthorizeMessage), 'SENT');
            ws.send(JSON.stringify(AuthorizeMessage));
        }
    }

    var verifyAuthorize = function(info){
        var data = info.idTagInfo;
        if(data.status == 'Accepted'){
            addMessage('Waiting');
        }else if(data.status == 'Rejected' || data.status == 'Expired' || data.status == 'Invalid'){
            console.log("Error",data.status);
        }
    }

    var verifyStatus = function(data){
        if(data[3].status == 'Preparing'){
            startButton.removeAttr('disabled');
        }else if(data[3].status == 'Started'){
            transactionId = data[3].ocppSessionId;
            stopButton.removeAttr('disabled');
        }else if(data[3].status == 'Stopped'){
            close();
        }
    }

    var startRemStart = function(){
        var idTag = $('#idTag').val();
        startTrasaction[3].connId = 1;
        startTrasaction[3].idTag = idTag;
        var obj = { uid: startTrasaction[1], action: startTrasaction[2] };
        lastMessage.push(obj);
        addMessage(JSON.stringify(startTrasaction), 'SENT');
        ws.send(JSON.stringify(startTrasaction));
    }

    var meter_value_notification = function(data){

    }

    var stopRemStart = function(){
        var idTag = $('#idTag').val();
        stopTrasaction[3].idTag = idTag;
        stopTrasaction[3].transactionId = transactionId;
        stopTrasaction[3].reason = reason;
        var obj = { uid: stopTrasaction[1], action: stopTrasaction[2] };
        lastMessage.push(obj);
        console.log("stop reason",lastMessage);
        addMessage(JSON.stringify(stopTrasaction), 'SENT');
        ws.send(JSON.stringify(stopTrasaction));
    }

    var verifyStartTransaction = function(data){
        if(data.status == 'Accepted'){
            stopButton.removeAttr('disabled');
        }
    }

    var verifyStopTransaction = function(data){
        console.log("verifyStopTransaction",data);
    }

    WebSocketClient = {
        init: function () {

            serverUrl = $('#url');
            cpID = $('#id');
            connectionStatus = $('#connectionStatus');

            connectButton = $('#connectButton');
            disconnectButton = $('#disconnectButton');
            disconnectButton.hide();

            connectButton.click(function (e) {
                close();
                open();
            });

            disconnectButton.click(function (e) {
                close();
            });

            startButton.click(function (e) {
                startRemStart();
            });

            stopButton.click(function (e) {
                stopRemStart();
            });

            $('#clearMessage').click(function (e) {
                clearLog();
            });
        }
    };
}

$(function () {
    $('#url').val('ws://localhost:4000/user/1');
    $('#idTag').val('TOK002');
    $('#cpId').val('cp001');
    WebSocketClient.init();
});