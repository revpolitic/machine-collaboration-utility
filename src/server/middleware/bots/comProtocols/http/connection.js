/*******************************************************************************
 * connection.js
 *
 * A class to manage opening, maintaining, and closing an http connection.
 ******************************************************************************/
var _ = require('underscore'),
    Heartbeat = require('heartbeater');
let logger;

var request = require(`request-promise`);
var request2 = require(`request`);
/**
 * HttpConnection()
 *
 * Manages an http connection.
 *
 *
 * User defined callbacks can be set for processing data, close and error
 *
 * Args:   externalEndpoint - external url that we are communicating with
 *         inInitDataFunc  - passed opening sequence data (inInitDataFunc(inData))
 *         inConnectedFunc - function to call when we have successfully
 *                           connected
 * Return: N/A
 */
class HttpConnection {
  constructor(app, externalEndpoint, doneFunction) {
    this.app = app;
    this.logger = app.context.logger;
    this.io = app.io;
    this.externalEndpoint = externalEndpoint;
    this.doneFunction = doneFunction;

    // User configurable data callback and close notification.  Our initial
    // data function handles the open sequence.
    this.mDataFunc = undefined;
    this.mCloseFunc = undefined;
    this.mErrorFunc = undefined;

    // A hack. Normally we would validate the connection and then call this function
    // once we are validated
    const getRequestParams = {
      method: `GET`,
      uri: this.externalEndpoint,
      json: true,
    };
    try {
      request(getRequestParams)
      .then((reply) => {
        if (reply.data.state === `connected`) {
          doneFunction(this);
        } else {
          const connectRequestParams = {
            method: `POST`,
            uri: this.externalEndpoint,
            body: {
              command: `connect`,
            },
            json: true,
          };
          try {
            request(connectRequestParams)
            .then(() => {
              doneFunction(this);
            })
            .catch((err) => {
              this.logger.info(err.error);
            });
          } catch (ex) {
            this.logger.error('Http connection error', ex);
          }
        }
      })
      .catch((err) => {
        this.logger.info(err.error);
      });
    } catch (ex) {
      this.logger.error('Http connection error', ex);
    }
  }

  /*******************************************************************************
   * Public interface
   *******************************************************************************/
  /**
   * setDataFunc(), setCloseFunc, setErrorFunc()
   *
   * Set the user configurable functions to call when we receive data,
   * close the port or have an error on the port.
   */
  setDataFunc(inDataFunc) {
    this.mDataFunc = inDataFunc;
  }

  setCloseFunc(inCloseFunc) {
    this.mCloseFunc = inCloseFunc;
  }

  setErrorFunc(inErrorFunc) {
    this.mErrorFunc = inErrorFunc;
  }

  /**
   * send()
   *
   * Send a command to the device
   *
   * Args:   inCommandStr - string to send
   * Return: N/A
   */
  send(inCommandStr) {
    var error = undefined;
    var commandSent = false;

    try {
      const requestParams = {
        method: `POST`,
        uri: `${this.externalEndpoint}`,
        body: {
          command: `processGcode`,
          gcode: inCommandStr,
        },
        json: true,
      };

      request(requestParams)
      .then((reply) => {
        if (_.isFunction(this.mDataFunc)) {
          this.mDataFunc(reply);
        }
        commandSent = true;
      })
      .catch((err) => {
        this.logger.info(err.error);
        setTimeout(() => {
          this.send(inCommandStr);
        }, 1000);
      });
    } catch (ex) {
      this.logger.error('Send command fail', ex);
    }
  }

  /**
   * close()
   *
   * Close our connection
   *
   * Args:   N/A
   * Return: N/A
   */
  async close() {
    const getRequestParams = {
      method: `GET`,
      uri: this.externalEndpoint,
      json: true,
    };
    try {
      const reply = request(getRequestParams)

      // use this line to handle states where disconnect should be idempodent
      if (false) {

      } else {
        const disconnectRequestParams = {
          method: `POST`,
          uri: this.externalEndpoint,
          body: {
            command: `disconnect`,
          },
          json: true,
        };
        try {
          await request(disconnectRequestParams);
        } catch (ex) {
          this.logger.error('Http connection error', ex);
        }
      }
    } catch (ex) {
      this.logger.error('Http connection error', ex);
    }
  }
}

module.exports = HttpConnection;
