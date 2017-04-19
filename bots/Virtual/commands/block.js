const path = require('path');
const botFsmDefinitions = require(path.join(process.env.PWD, 'react/modules/Bots/botFsmDefinitions'));
const jobFsmDefinitions = require(path.join(process.env.PWD, 'react/modules/Jobs/jobFsmDefinitions'));

module.exports = async function block(self, params) {
  try {
    if (self.fsm.current !== 'executingJob') {
      throw new Error(`Cannot block from state "${self.fsm.current}"`);
    }
    const commandArray = [];

    // We want block to happen in a very specific order
    // 1. Start block from the state machine immediately
    // 2. Allow for block movements / macros / etc
    // 3. Complete state machine block transition by signaling that block is complete
    //
    // In order to accomplish this, we must prepend the current commands in the queue
    // We call the state machine command "block"
    // In the postCallback of 1, we prepend 2 to the queue
    // Then in the postCallback of 2, we prepend 3 to the queue
    //
    // This comes across a bit backwards, but the ordering is necessary in order to prevent
    // transitioning to an incorrect state

    const blockEndCommand = {
      postCallback: () => {
        self.fsm.blockDone();
      },
    };

    self.queue.prependCommands({
      preCallback: () => {
        self.logger.debug('Starting block movements');
      },
      delay: 1000,
      postCallback: () => {
        self.logger.debug('Done with block movements');
        self.queue.prependCommands(blockEndCommand);
      }
    });

    self.logger.debug('Just queued block', self.getBot().settings.name, self.fsm.current);
    self.fsm.block();
  } catch (ex) {
    self.logger.error('Block error', ex);
  }

  return self.getBot();
};
