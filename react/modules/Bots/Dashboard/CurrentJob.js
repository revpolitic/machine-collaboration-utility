import React from 'react';
import request from 'superagent';
import ProgressBar from 'react-bootstrap/lib/ProgressBar';
import Button from 'react-bootstrap/lib/Button';
import File from '../../Files/File';

import { metaStates as botMetaStates } from '../botFsmDefinitions';

export default class CurrentJob extends React.Component {
  constructor(props) {
    super(props);

    this.sendCommand = this.sendCommand.bind(this);
    this.cancelJob = this.cancelJob.bind(this);
  }

  sendCommand(command) {
    request.post(this.props.endpoint)
    .send({ command })
    .set('Accept', 'application/json')
    .end();
  }

  cancelJob() {
    request.post(this.props.endpoint)
    .send({ command: 'cancel' })
    .set('Accept', 'application/json')
    .end();
  }

  renderConnectButton() {
    if (this.props.bot.state === 'uninitialized') {
      return <Button onClick={() => { this.sendCommand('discover'); }}>Detect</Button>;
    }

    if (this.props.bot.state === 'uninitialized' || this.props.bot.state === 'ready') {
      return <Button className="connect" onClick={() => { this.sendCommand('connect') } }>Connect</Button>;
    }
    if (botMetaStates.connected.includes(this.props.bot.state)) {
      return <Button className="disconnect" onClick={() => { this.sendCommand('disconnect'); }}>Disconnect</Button>;
    }

    return <Button className="disconnect" disabled>{this.props.bot.state}</Button>;
  }

  renderPauseButton() {
    if (this.props.bot.currentJob === undefined) {
      return <Button className="pause-resume" disabled>Pause</Button>;
    }

    switch (this.props.bot.state) {
      case 'paused':
        return <Button className="resume" onClick={() => { this.sendCommand('resume'); }}>Resume</Button>;
      case 'executingJob':
        return <Button className="pause" onClick={() => { this.sendCommand('pause'); }}>Pause</Button>;
      default:
        return <Button className="pause-resume" disabled>Pause/Resume</Button>;
    }
  }

  renderCancelButton() {
    if (this.props.bot.currentJob === undefined) {
      return <Button className="cancel" bsStyle="danger" disabled>Cancel</Button>;
    }
    return <Button className="cancel" bsStyle="danger" onClick={this.cancelJob}>Cancel</Button>;
  }

  findMostRecentUpload() {
    let newestFile = null;
    this.props.files && Object.entries(this.props.files).forEach(([fileKey, file]) => {
      // Don't include files that cant be processed by this bot
      const fileExtension = '.' + file.name.split('.')[file.name.split('.').length - 1];
      if (this.props.bot.info.fileTypes.includes(fileExtension)) {
        // If this file is newer than the reigning newest file, replace it
        if (!newestFile || file.dateChanged > newestFile.dateChanged) {
          newestFile = file;
        }
      }
    });
    return newestFile;
  }

  printFile(fileUuid) {
    const requestParams = {
      command: 'startJob',
      fileUuid,
    };

    request.post(`/v1/bots/${this.props.bot.settings.uuid}`)
    .send(requestParams)
    .set('Accept', 'application/json')
    .end()
    .catch((err) => {
      // console.log('request error', err);
    });
  }

  renderProgressBar() {
    if (this.props.bot.currentJob === undefined) {
      // Render the most recent file
      const newestFile = this.findMostRecentUpload();
      if (newestFile) {
        const buttonReady = this.props.bot.state === 'idle';
        return (
          <div>
            <Button
              className="pause-resume"
              disabled={!buttonReady}
              style={{ width: '100%', backgroundColor: buttonReady ? '#90bb95' : '#9FA1A4' }}
              onClick={() => this.printFile(newestFile.uuid)}
            >
            Print "{newestFile.name}"
            </Button>
          </div>
        );
      }
      return null;
    }
    const percentComplete = this.props.bot.currentJob.percentComplete;
    const percentTextStyle = {
      position: 'absolute',
      right: 0,
      left: 0,
      color: '#f5f5f5',
    };

    return (
      <div style={{ textAlign: 'center' }}>
        <span style={percentTextStyle}>{`${percentComplete}%`} </span>
          <ProgressBar style={{ backgroundImage: 'none', backgroundColor: '#AEAEAE' }} active now={percentComplete} key={0} />
          {/*<ProgressBar bsStyle="success" now={100 - percentComplete} key={1} />*/}
      </div>
    );
  }

  render() {
    return (
      <div>
        <div className="max-area-width no-margin">
          <h3>CURRENT STATE: {this.props.bot.state.toUpperCase()}</h3>
          <div className="row">
            <div className="col-xs-4 no-padding-right">
              {this.renderConnectButton()}
            </div>
            <div className="col-xs-4 no-padding">
              {this.renderPauseButton()}
            </div>
            <div className="col-xs-4 no-padding-left">
              {this.renderCancelButton()}
            </div>
          </div>
          <br />
        </div>
        <div className="progress-area" style={ this.props.bot.currentJob ? { height: '20px', marginTop: '-10px' } : { height: '40px', marginTop: '-20px' }}>
          {this.renderProgressBar()}
        </div>
      </div>
    );
  }
}
