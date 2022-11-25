new function () {
    var ws = null;
    var connected = false;
    var options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
    var serverUrl;
    var cpID;
    var connectionStatus;
	
	var connStatus = {
		"1" : {
			'Status':'Unavailable',
			'isCharging': 0,
			'transactionId': 0, 
			'meterCount': 1,
			'mTimerId': null
			},
		"2" : {
			'Status':'Unavailable',
			'isCharging': 0,
			'transactionId': 0,
			'meterCount': 1,
			'mTimerId': null
			}
	}
	
    var timerId = null;

    var connectButton;
    var disconnectButton;

    var lastMessage = [];
    var HeartbeatInterval = 30;
    var MeterValueSampleInterval = 10;
    var MinimumStatusDuration = 10;
	$('#HeartbeatInterval').val(HeartbeatInterval);
    $('#MeterValueSampleInterval').val(MeterValueSampleInterval);
	
    var HeartBeat = [2,1, "Heartbeat", {}];

    var BootNotification = [2, 2, "BootNotification", {
        chargePointVendor: 'Simulator',
        chargePointModel: 'DC001',
        chargePointSerialNumber:'',
        chargeBoxSerialNumber: 'cpsn001',
        firmwareVersion: '1.0.49',
        iccid: '',
        imsi: '',
        meterType: 'DBT NQC-ACDC',
        meterSerialNumber: 'gir.vat.mx.000e48'
    }];

    var StatusNotification = [2,3,"StatusNotification",{"connectorId":1,"errorCode":"NoError","info":"NoInfo","status":"Available","timestamp":"2018-08-27T10:43:14.250Z","vendorErrorCode":"","vendorId":""}];

    var AuthorizeMessage = [2, 4, "Authorize", { "idTag": "TOK001" }];

    var StartTransaction = [2, 5, "StartTransaction", {
        "connectorId": 0,
        "idTag": 'TOK001',
        "timestamp": new Date(),
        "meterStart": 0,
        "reservationId": 0
    }];

    var StopTransaction = [2, 6, "StopTransaction", { "idTag": "TOK001", "meterStop": "", "timestamp": "", "transactionId": "" , "reason":""}];

    // var meterValues = [2, 7, "MeterValues", {
    //     "connectorId": "", "transactionId": "", "meterValue":[
    //         {
    //             "timestamp": new Date(),
    //             "sampledValue":[
	// 				{
	// 					"context":"Sample.Periodic",
	// 					"format":"Raw",
	// 					"measurand":"SoC",
	// 					"location":"EV",
	// 					"unit":"Percent",
	// 					"phase":null,
	// 					"value": "0"
	// 				}
	// 			]
    //         },
	// 		{
	// 			"timestamp": new Date(),
    //             "sampledValue":[
	// 				{
	// 					"value": "0",
	// 					"context": "Sample.Periodic",
	// 					"format": "Raw",
	// 					"measurand": "Energy.Active.Import.Interval",
	// 					"phase": "L1",
	// 					"location": "Outlet",
	// 					"unit": "Wh"
	// 				}
	// 			]
	// 		},
	// 		{  
	// 			"timestamp": new Date(),
	// 			"sampledValue":[  
	// 				{  
	// 				   "value":"0",
	// 				   "context":"Sample.Periodic",
	// 				   "format":"Raw",
	// 				   "measurand":"Energy.Active.Import.Register",
	// 				   "phase": "L1",
	// 				   "location":"Outlet",
	// 				   "unit":"Wh"
	// 				}
	// 			]
	// 		}
    //     ]
    // }];

    var meterValues = [2, 7, "MeterValues", {
        "connectorId": "", "transactionId": "", "meterValue":[
            {
                "timestamp": new Date(),
                "sampledValue":[
					{
						"context":"Sample.Periodic",
						"format":"Raw",
						"measurand":"SoC",
						"location":"EV",
						"unit":"Percent",
						"phase":null,
						"value": "0"
					}
				]
            },
			{
				"timestamp": new Date(),
                "sampledValue":[
					{
						"value": "0",
						"context": "Sample.Periodic",
						"format": "Raw",
						"measurand": "",
						"phase": "L1",
						"location": "Outlet",
						"unit": "Wh"
					}
				]
			}
        ]
    }];
    var open = function () {
        var url = serverUrl.val() + cpID.val();
        ws = new WebSocket(url);
        ws.onopen = onOpen;
        ws.onclose = onClose;
        ws.onmessage = onMessage;
        ws.onerror = onError;

        connectionStatus.text('OPENING ...');
        serverUrl.attr('disabled', 'disabled');
        cpID.attr('disabled', 'disabled');
        $("#connectorId").attr('disabled', 'disabled');
		serverUrl.val()
        localStorage.setItem("url", serverUrl.val());
        localStorage.setItem("id", cpID.val());
        localStorage.setItem("idTag", $("#idTag").val());
        localStorage.setItem("connectorId",$("#connectorId").val());
      
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
        lastMessage = [];
        serverUrl.removeAttr('disabled');
        cpID.removeAttr('disabled');
        $("#connectorId").removeAttr('disabled');
        connectButton.show();
        disconnectButton.hide();
        //pluginButton.attr('disabled', 'disabled');
        //startButton.attr('disabled', 'disabled');
        //stopButton.attr('disabled', 'disabled');
		$("#conn1Div").hide();
		$("#conn2Div").hide();
        localStorage.removeItem("url");
        localStorage.removeItem("id");
        localStorage.removeItem("idTag");
        localStorage.removeItem("connectorId");
    }

    var clearLog = function () {
        $('#messages').html('');
    }

    var onOpen = function () {
        clearLog();
        console.log('OPENED: ' + serverUrl.val() + cpID.val());
        connected = true;
        
        connectionStatus.text('OPENED');
        lastMessage = [];
        setTimeout(() => { startBootScene(); }, 3000);
		HeartbeatInterval = $('#HeartbeatInterval').val();
		MeterValueSampleInterval = $('#MeterValueSampleInterval').val();
    };

    var onClose = function () {
        console.log('CLOSED: ' + serverUrl.val());
        ws = null;
        clearInterval(timerId);
        clearInterval(connStatus[1]['mTimerId']);
        clearInterval(connStatus[2]['mTimerId']);
		close();
    };

    var onMessage = function (event) {
        var data = event.data;
        addMessage(data);
        var parsedData = JSON.parse(data);
        if (parsedData[0] == 3) {
            if (parsedData[1] == lastMessage[lastMessage.length - 1].uid) {
                switch (lastMessage[lastMessage.length - 1].action) {
                    case 'BootNotification': verifyBootConfirmation(parsedData[2]);
                    break;
                    case 'Authorize': verifyAuthorize(parsedData[2],lastMessage[lastMessage.length - 1].connID);
                    break;
                    case 'StartTransaction': verifyStartTrasaction(parsedData[2],lastMessage[lastMessage.length - 1].connID);
                    break;
                }
            }
        }
        else if (parsedData[0] == 2) {
            switch (parsedData[2]) {
                case 'RemoteStartTransaction': RemoteStartTransaction(parsedData);
                break;
				
                case 'RemoteStopTransaction': RemoteStopTransaction(parsedData);
                break;
				
				case 'GetConfiguration': GetConfiguration(parsedData);
                break;
				
				case 'ChangeConfiguration': ChangeConfiguration(parsedData);
                break;
				
				case 'GetLocalListVersion': GetLocalListVersion(parsedData);
                break;
				
				case 'UpdateFirmware': UpdateFirmware(parsedData);
                break;
				
				case 'TriggerMessage': TriggerMessage(parsedData);
                break;
				
				case 'GetDiagnostics': GetDiagnostics(parsedData);
                break;
				
				case 'DataTransfer': DataTransfer(parsedData);
                break;
				
				case 'ChangeAvailability': ChangeAvailability(parsedData);
                break;
				
				case 'ClearCache': ClearCache(parsedData);
                break;
				
				case 'Reset': Reset(parsedData);
                break;
				
				case 'UnlockConnector': UnlockConnector(parsedData);
                break;
				
				case 'ReserveNow': ReserveNow(parsedData);
                break;
				
				case 'CancelReservation': CancelReservation(parsedData);
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

    var startHeartBeat = function () {
        //var obj = { uid: HeartBeat[1], action: HeartBeat[2] };
        //lastMessage.push(obj);
		HeartBeat[1] = new Date().getTime();
        addMessage(JSON.stringify(HeartBeat), 'SENT');
        ws.send(JSON.stringify(HeartBeat));
    }

    var startBootScene = function () {
		BootNotification[1] = new Date().getTime();
        var obj = { uid: BootNotification[1], action: BootNotification[2] };
        lastMessage.push(obj);
        addMessage(JSON.stringify(BootNotification), 'SENT');
        ws.send(JSON.stringify(BootNotification));
    }

    var verifyBootConfirmation = function (data) {
        if(data.status == 'Rejected'){
            close();
        }else if(data.status == 'Accepted'){
            connected = true;
            HeartbeatInterval = data.interval;
            timerId = setInterval(function(){ if(connected){ startHeartBeat(); } }, HeartbeatInterval*1000);
            setTimeout(() => {
				if($("#connectorId").val() == '2'){
					sendStatusNotification('Available',1);
					sendStatusNotification('Available',2);
					$("#conn2Div").show();
					
					qrcode1.makeCode($('#id').val()+"_1");
					qrcode2.makeCode($('#id').val()+"_2");
					$("#connStatus1Div").show();
					$("#connStatus2Div").show();
				}else{
					sendStatusNotification('Available',1);
					$("#conn1Div").show();
					qrcode1.makeCode($('#id').val()+"_1");
					$("#connStatus1Div").show();
				}
			}, 3000);
			
            //pluginButton.removeAttr('disabled');
        }
    }
	
    var sendStatusNotification = function(status,connId,eCode){
		if(connId>0){
			connStatus[connId]['Status'] = status;
		}
		
		if(eCode){
			StatusNotification[3].errorCode = eCode;
		}else{
			StatusNotification[3].errorCode = 'NoError';
		}
		
		//var connId = $("#connectorId").val();
        StatusNotification[1] = new Date().getTime();
        console.log(connId);
        StatusNotification[3].connectorId =  $("#connectorIds").val();
        StatusNotification[3].status = status;
        StatusNotification[3].timestamp = new Date();
		$("#status"+connId).text(status);
        //var obj = { uid: StatusNotification[1], action: StatusNotification[2] };
        //lastMessage.push(obj);
        addMessage(JSON.stringify(StatusNotification), 'SENT');
        ws.send(JSON.stringify(StatusNotification));
    }

    var authorizeUser = function(connID){
        var idTag = $('#idTag').val();

        if((connStatus[connID]['Status'] == 'Preparing' || connStatus[connID]['Status'] == 'Charging') && idTag){
			AuthorizeMessage[1] = new Date().getTime();
            AuthorizeMessage[3].idTag = idTag;
            var obj = { uid: AuthorizeMessage[1], action: AuthorizeMessage[2], connID:connID };
            lastMessage.push(obj);
            addMessage(JSON.stringify(AuthorizeMessage), 'SENT');
            ws.send(JSON.stringify(AuthorizeMessage));
        }
    }

    var verifyAuthorize = function(info,connID){
        var data = info.idTagInfo;
        if(data.status == 'Accepted'){
            if(connStatus[connID]['isCharging'] == 1){
                sendStatusNotification('Finishing',connID);
                stopCP(connID);
            }else if(connStatus[connID]['isCharging'] == 0){
                sendStatusNotification('Charging',connID);
                startCP(connID);
            }
        }else if(data.status == 'Blocked' || data.status == 'Expired' || data.status == 'Invalid'){
            console.log("Error");
        }
    }

    var startCP = function(connId){
        var idTag = $('#idTag').val();
       
        var meterStart = $('#meterStart').val();
        StartTransaction[1] = new Date().getTime();
        StartTransaction[3].connectorId = connId;
        StartTransaction[3].idTag = idTag;
        StartTransaction[3].meterStart = meterStart;
        var obj = { uid: StartTransaction[1], action: StartTransaction[2], connID:connId };
        lastMessage.push(obj);
        addMessage(JSON.stringify(StartTransaction), 'SENT');
        ws.send(JSON.stringify(StartTransaction));
    }

    var verifyStartTrasaction = function(data,connId){
        if(data.transactionId){
			var meterStart = $('#meterStart').val();
			connStatus[connId]['meterCount'] = parseInt(meterStart);
            connStatus[connId]['transactionId'] = data.transactionId;
            connStatus[connId]['isCharging'] = 1;
            connStatus[connId]['mTimerId'] = setInterval(function(){
				if(connected){
					sendMeterValues(connStatus[connId]['meterCount'].toFixed(2),connId);
					connStatus[connId]['meterCount'] = parseInt(connStatus[connId]['meterCount'])+100; 
				} 
			}, MeterValueSampleInterval*1000);
            //stopButton.removeAttr('disabled');
        }else{
            connStatus[connId]['transactionId'] = 0;
            connStatus[connId]['isCharging'] = 0;
        }
    }

    var sendMeterValues = function(meterCount,connId){
		var unit = $('#unit').val();
        meterValues[1] = new Date().getTime();
        meterValues[3].connectorId = connId;
        meterValues[3].transactionId = connStatus[connId]['transactionId'];
		
        meterValues[3].meterValue[0].timestamp = new Date();
        if($('#currentType').val() == "DC"){
            meterValues[3].meterValue[0].sampledValue[0].value = String((meterCount/10));
                    if( meterValues[3].meterValue[0].sampledValue[0].value == 100){
                       stopCP(connId,0);
                   }
                     }
		meterValues[3].meterValue[1].timestamp = new Date();
        meterValues[3].meterValue[1].sampledValue[0].value = String(meterCount/7);
        meterValues[3].meterValue[1].sampledValue[0].unit = unit;
        meterValues[3].meterValue[1].sampledValue[0].measurand = $('#mesurend').val();
  
        // meterValues[3].meterValue[2].timestamp = new Date();
        // meterValues[3].meterValue[2].sampledValue[0].value = meterCount;
        // meterValues[3].meterValue[2].sampledValue[0].unit = unit;
        //var obj = { uid: meterValues[1], action: meterValues[2] };
        //lastMessage.push(obj);
		$("#meter"+connId).text(meterCount);
        addMessage(JSON.stringify(meterValues), 'SENT');
        ws.send(JSON.stringify(meterValues));
    }
    var stopCP = function(connId,isEmrg){
        clearInterval(connStatus[connId]['mTimerId']);
        var idTag = $('#idTag').val();
       
        var eReason = $('#eReason').val();
        StopTransaction[1] = new Date().getTime();
        StopTransaction[3].idTag = idTag;
        StopTransaction[3].meterStop = connStatus[connId]['meterCount'];
        StopTransaction[3].timestamp = new Date();
        StopTransaction[3].transactionId = connStatus[connId]['transactionId'];
        StopTransaction[3].reason = eReason;
        var obj = { uid: StopTransaction[1], action: StopTransaction[2] };
        lastMessage.push(obj);
        addMessage(JSON.stringify(StopTransaction), 'SENT');
        ws.send(JSON.stringify(StopTransaction));
        connStatus[connId]['transactionId'] = 0;
        connStatus[connId]['isCharging'] = 0;
        connStatus[connId]['meterCount'] = 1;
		if(isEmrg!=1){
			setTimeout(() => { sendStatusNotification('Available',connId); }, 2000);
		}
    }

    var RemoteStartTransaction = function(data){
		setTimeout(() => {
			if(connStatus[data[3].connectorId]['Status'] == 'Preparing' && connStatus[data[3].connectorId]['isCharging'] == 0){
				$('#idTag').val(data[3].idTag);
				var remStartConf = [3,data[1],{'status':'Accepted'}];
				addMessage(JSON.stringify(remStartConf), 'SENT');
				ws.send(JSON.stringify(remStartConf));
				authorizeUser(data[3].connectorId);
				//sendStatusNotification('Charging');
				//startCP();
			}else if(connStatus[data[3].connectorId]['Status'] == 'Available' && connStatus[data[3].connectorId]['isCharging'] == 0){
				sendStatusNotification('Preparing',data[3].connectorId);
				$('#idTag').val(data[3].idTag);
				var remStartConf = [3,data[1],{'status':'Accepted'}];
				addMessage(JSON.stringify(remStartConf), 'SENT');
				ws.send(JSON.stringify(remStartConf));
				authorizeUser(data[3].connectorId);
			}
			else{
				var remStartConf = [3,data[1],{'status':'Rejected'}];
				addMessage(JSON.stringify(remStartConf), 'SENT');
				ws.send(JSON.stringify(remStartConf));
			}
		}, 2000);
    }

    var RemoteStopTransaction = function(data){
        if(data[3].transactionId == connStatus["1"]['transactionId']){
			authorizeUser(1);
            //sendStatusNotification('Finishing');
            //stopCP();
        }else if(data[3].transactionId == connStatus["2"]['transactionId']){
			authorizeUser(2);
            //sendStatusNotification('Finishing');
            //stopCP();
        }else{
            var remStopConf = [3,data[1],{'status':'Rejected'}];
            addMessage(JSON.stringify(remStopConf), 'SENT');
            ws.send(JSON.stringify(remStopConf));
        }
    }

    var GetConfiguration = function(data){
		var get_config = [3,data[1],{'configurationKey':[
			{
				'key':'HeartbeatInterval',
				'readonly':false,
				'value':HeartbeatInterval
			},
			{
				'key':'MeterValueSampleInterval',
				'readonly':false,
				'value':MeterValueSampleInterval
			},
			{
				'key':'MinimumStatusDuration',
				'readonly':false,
				'value':MinimumStatusDuration
			}
		],'unknownKey':[]}];
		addMessage(JSON.stringify(get_config), 'SENT');
		ws.send(JSON.stringify(get_config));
	}
	
	var ChangeConfiguration = function(data){
		//console.log(data[3]);
		var change_config = [3,data[1],{'status':'Accepted'}];
		switch(data[3].key){
			case 'HeartbeatInterval': HeartbeatInterval = data[3].value; change_config[2].status = 'Accepted';
			break;
			case 'MeterValueSampleInterval': MeterValueSampleInterval = data[3].value; change_config[2].status = 'Accepted';
			break;
			case 'MinimumStatusDuration': MinimumStatusDuration = data[3].value; change_config[2].status = 'Accepted';
			break;
			default: change_config[2].status = 'Rejected';
		}
		
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var GetLocalListVersion = function(data){
		var change_config = [3,data[1],{'listVersion':'123'}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var UpdateFirmware = function(data){
		var change_config = [3,data[1],{}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var TriggerMessage = function(data){
		var trig_msg = [3,data[1],{'status':'Rejected'}];
		if(data[3].requestedMessage == 'StatusNotification'){
			sendStatusNotification(connStatus[data[3].connectorId]['Status'],data[3].connectorId);
			trig_msg[2].status = 'Accepted';
		}
		
		addMessage(JSON.stringify(trig_msg), 'SENT');
		ws.send(JSON.stringify(trig_msg));
	}
	
	var GetDiagnostics = function(data){
		var change_config = [3,data[1],{'fileName':''}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var DataTransfer = function(data){
		var change_config = [3,data[1],{'status':'Rejected',"data":"" }];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var ChangeAvailability = function(data){
        console.log(data[3].type);
        if(data[3].type =='Operative'){
            sendStatusNotification('Available',data[3].connectorId);
        }
        else{
            sendStatusNotification('Unavailable',data[3].connectorId);
        }
        var status_config =[3,data[1],{'status':'Accepted'}];
        addMessage(JSON.stringify(status_config), 'SENT');
        
        
        ws.send(JSON.stringify(sendStatusNotification));
		// var change_config = [3,data[1],{'status':'Rejected'}];
		// addMessage(JSON.stringify(change_config), 'SENT');
		// ws.send(JSON.stringify(change_config));
		// var change_config = [3,data[1],{'status':'Rejected'}];
		// addMessage(JSON.stringify(change_config), 'SENT');
		// ws.send(JSON.stringify(change_config));
	}
	
	var ClearCache = function(data){
		var change_config = [3,data[1],{'status':'Rejected'}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var Reset = function(data){
		var change_config = [3,data[1],{'status':'Rejected'}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var UnlockConnector = function(data){
		var change_config = [3,data[1],{'status':'NotSupported'}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}

	var ReserveNow = function(data){
		var change_config = [3,data[1],{'status':'Rejected'}];
		if(connStatus[data[3].connectorId]['isCharging'] == 1){
            change_config[2].status = 'Accepted';
            addMessage(JSON.stringify(change_config), 'SENT');
            ws.send(JSON.stringify(change_config));
           
        }	else{
            addMessage(JSON.stringify(change_config), 'SENT');
            ws.send(JSON.stringify(change_config));	
           
        }
        if(change_config[2].status = 'Accepted')
         sendStatusNotification('Reserved',data[3].connectorId);
       
	}
	
	var CancelReservation = function(data){
		var change_config = [3,data[1],{'status':'Accepted'}];
		addMessage(JSON.stringify(change_config), 'SENT');
		ws.send(JSON.stringify(change_config));
	}
	
	var qrcode1 = new QRCode(document.getElementById("qrcode1"), {
		width : 100,
		height : 100
	});
	
	var qrcode2 = new QRCode(document.getElementById("qrcode2"), {
		width : 100,
		height : 100
	});
	
	WebSocketClient = {
        init: function () {

            serverUrl = $('#url');
            console.log(serverUrl)
            cpID = $('#id');
            connectionStatus = $('#connectionStatus');

            connectButton = $('#connectButton');
            disconnectButton = $('#disconnectButton');
            disconnectButton.hide();

            connectButton.click(function (e) {
                close();
                open();
            });
            localStorage.setItem("url", serverUrl);
            localStorage.setItem("cpID", cpID);
			
            disconnectButton.click(function (e) {
                close();
            });
			
			$('#pluginButton').click(function (e) {
                sendStatusNotification('Preparing',1);
                //startButton.removeAttr('disabled');
            });

			$('#unplugButton').click(function (e) {
                sendStatusNotification('Available',1);
                //startButton.removeAttr('disabled');
            });

            $('#startButton').click(function (e) {
                authorizeUser(1);
            });

            $('#stopButton').click(function (e) {               
                authorizeUser(1);
            });
			
			$('#pluginButton1').click(function (e) {
                sendStatusNotification('Preparing',1);
                //startButton.removeAttr('disabled');
            });

			$('#cpFaulted').click(function (e) {
                sendStatusNotification('Faulted',0);
				$('#cpFaulted').hide();
				$('#cpAvailable').show();
            });
			
			$('#cpPoweroff').click(function (e) {
				var connectorId = $('#connectorId').val();
				
				for(var i = 1; i <= connectorId; i++){
					if(connStatus[i]['isCharging'] == 1){
						//sendStatusNotification('Finishing',i);
						stopCP(i,1);
					}
				}
				
				setTimeout(function(){ 
					for(var i = 1; i <= connectorId; i++){
						sendStatusNotification('Unavailable',i,"OtherError");
					}
				}, 2000);
            });
			
			$('#cpAvailable').click(function (e) {
                sendStatusNotification('Available',0);
				$('#cpFaulted').show();
				$('#cpAvailable').hide();
            });

            $('#startButton1').click(function (e) {
                authorizeUser(1);
            });
			
			$('#errorTrigger').click(function (e) {
				var eStatus = $('#eStatus').val();
				var eCode = $('#eCode').val();
                sendStatusNotification(eStatus,1,eCode);
            });


            $('#reasonTrigger').click(function (e) {
                var eReason =  $('#eReason').val();
                authorizeUser(1);
            });
            
            $('#stopButton1').click(function (e) {
                authorizeUser(1);
            });
			
			$('#pluginButton2').click(function (e) {
                sendStatusNotification('Preparing',2);
                //startButton.removeAttr('disabled');
            });

            $('#startButton2').click(function (e) {
                authorizeUser(2);
            });

            $('#stopButton2').click(function (e) {
                authorizeUser(2);
            });

            $('#clearMessage').click(function (e) {
                clearLog();
            });
        }
    };
}

$(function () {
    if(localStorage.getItem("url"))
    {
        var u = localStorage.getItem("url")
        $('#url').val(u)
    }
    else{

        $('#url').val('ws://demo.numocity.in:9033/ocpp/');
    }
    if(localStorage.getItem("id"))
    {
        var u = localStorage.getItem("id")
        $('#id').val(u)
    }
    else{

        $('#id').val('TC001');
    }
    if(localStorage.getItem("connectorId"))
    {
        var u = localStorage.getItem("connectorId")
        $('#connectorId').val(u)
    }
    else{

        $('#connectorId').val('1');
    }
    if(localStorage.getItem("idTag"))
    {
        var u = localStorage.getItem("idTag")
        $('#idTag').val(u)
    }
    else{

        $('#idTag').val('1D6E0259C');
    }
   

    $('#key').val('7292c87c6ed511e8adc0fa7ae01bbebc');
    $('#version').val('1.6');
    $('#format').val('json');
  
    $('#meterStart').val('0');
    $('#unit').val('Wh');
    WebSocketClient.init();
});