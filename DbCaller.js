var redis = require("redis");
var config = require("./config.js");
var mysql = require("mysql");
var client = redis.createClient(config.RedisPortNo, config.RedisIPAddress);

//handle Get Db Connection String
function handleGetDbConnectionString(ProgramCode, CallBackFun) {
  try {
    client.on("connect", function () {
      console.log("redis connected");
    });
    client.get("Con" + ProgramCode.toLowerCase(), function (err, reply) {
      if (reply) {
        var connectionStringMain = {};
        var stringCon = JSON.stringify(reply.slice(1)).split(";");

        for (i = 0; i < stringCon.length; i++) {
          var data = stringCon[i];
          var splitdata = data.split("=");
          if (splitdata[0] == '"server') {
            connectionStringMain.host = splitdata[1];
          }
          if (splitdata[0] == "userid") {
            connectionStringMain.user = splitdata[1];
          }
          if (splitdata[0] == "password") {
            connectionStringMain.password = splitdata[1];
          }
          if (splitdata[0] == "database") {
            connectionStringMain.database = splitdata[1]
              .replace(/\\/g, "")
              .replace('"', "")
              .replace('"', "");
          }
        }
        //return to call back funcation
        CallBackFun(connectionStringMain);
      }
      if (err) {
        console.log(error, "---Get Connection String");
      }
    });
  } catch (error) {
    console.log(error, "---Get Connection String");
  }
}

//handle Db get chat notitification detials SP Calling Function
function handleDbGetCustomerFBIDSPCalling(dataParam, callBackFuncation) {
    handleGetDbConnectionString(
      dataParam.ProgramCode,
      function (connectionString) {
        let connection = mysql.createConnection(connectionString);
        var sql = "call SP_HSGetCustomerFBID(?,?,?)";
  
        console.log(sql, "-----sql");
        connection.query(
          sql,
          [dataParam.ProgramCode, dataParam.MobileNo, dataParam.StoreCode],
          (error, results, fields) => {
            if (error) {
              if (config.ErrorLog) {
                var dataParamError = {};
                dataParamError.tenant_ID = dataParam.tenant_ID;
                dataParamError.Message = error.message || "";
                dataParamError.MessageStack = error.messageStack || "";
                dataParamError.Type = "SP_UpdateHSChatNotification" || "";
                handleSaveSP_ErrorLog(dataParamError);
              }
              return console.error(error.message, " Query Execution Exception");
            }
  
            callBackFuncation(results);
          }
        );
        connection.end();
      }
    );
  }

  ///handle save sp error logs
function handleSaveSP_ErrorLog(dataParam) {
    handleGetDbConnectionString(
      dataParam.ProgramCode,
      function (connectionString) {
        let connection = mysql.createConnection(connectionString);
        var sql =
          "call SP_ErrorLog(" +
          0 +
          "," +
          dataParam.tenant_ID +
          ",'NodeJs',?,?,?,'0.0.0.0')";
        console.log(sql, "-----sql");
        connection.query(
          sql,
          [dataParam.Type, dataParam.Message, dataParam.MessageStack || ""],
          (error, results, fields) => {
            if (error) {
              return console.error(error.message, " Query Execution Exception");
            }
          }
        );
        connection.end();
      }
    );
  }

  module.exports = {
    handleSaveSP_ErrorLog: handleSaveSP_ErrorLog,
    handleDbGetCustomerFBIDSPCalling: handleDbGetCustomerFBIDSPCalling,
  };