const Koa = require(`koa`);
const cors = require(`koa-cors`);
const convert = require(`koa-convert`);
const bodyparser = require(`koa-bodyparser`);
const json = require(`koa-json`);
const serve = require('koa-static');
const winston = require(`winston`);
const IO = require(`koa-socket`);
const path = require(`path`);
const Sequelize = require(`sequelize`);
const router = require(`koa-router`)();
const _ = require(`underscore`);
const stringify = require(`json-stringify-safe`);
const bsync = require(`asyncawait/async`);
const bwait = require(`asyncawait/await`);

const React = require(`react`);
const renderToString = require(`react-dom/server`).renderToString;
const match = require(`react-router`).match;
const RouterContext = require(`react-router`).RouterContext;

// NOTE THIS FILE IS COPIED IN BY GULP FROM CLIENT/JS
const routes = require(`../dist/react/routes`);

const Files = require(`./middleware/files`);
const Jobs = require(`./middleware/jobs`);
const Bots = require(`./middleware/bots`);

function renderPage(appHtml, jsVariables = {}) {
  return `<!doctype html public="storage">
<html>
<meta charset=utf-8/>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hydra-Print</title>
<link rel=stylesheet href=/styles.css>
<div id=app><div>${appHtml}</div></div>
<script src="/vendorJs/jquery.min.js"></script>
<script>var APP_VAR=${stringify(jsVariables)}</script>
<script src="/vendorJs/bootstrap.min.js"></script>
<script src="/vendorJs/socket.io.js"></script>
<script src="/bundle.js"></script>
</html>
`;
}

module.exports = bsync((config) => {
  // Setup logger
  const filename = path.join(__dirname, `../${config.logFileName}`);
  const logger = new (winston.Logger)({
    level: `debug`,
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({ filename }),
    ],
  });

  const app = new Koa();

  // on 'error' is first in the koa middleware stack, should this be moved?
  app.on(`error`, (error, ctx) => {
    app.context.logger.error(`server error`, error, ctx);
  });

  app.context.config = config;
  app.context.logger = logger;

  // Add middleware
  app.use(convert(cors()));
  app.use(convert(bodyparser()));
  app.use(convert(json()));
  app.use(convert(serve(path.join(__dirname, `../dist/clientAssets`))));

  // attach socket middleware
  const io = new IO();
  io.attach(app);

  // attach database context
  const sequelize = new Sequelize(`postgres://${process.env.username}:${process.env.password}@localhost:5432/${process.env.dbname}`);

  // check database connection
  const err = bwait(sequelize.authenticate());

  if (err) {
    const errorMessage = `Unable to connect to the database: ${err}`;
    app.context.logger.error(err);
    throw (errorMessage);
  } else {
    app.context.db = sequelize;
  }


  // // Just wipe the database each time until we can smooth things out
  // app.context.db.sync({ force: true });

  // add custom middleware here
  const files = new Files(app, `/${config.apiVersion}/files`);
  bwait(files.initialize());

  const jobs = new Jobs(app, `/${config.apiVersion}/jobs`);
  bwait(jobs.initialize());

  const bots = new Bots(app, `/${config.apiVersion}/bots`);
  bwait(bots.initialize());

  // app.context.db.sync({ force: true });

  // Set up Koa to match any routes to the React App. If a route exists, render it.
  router.get('*', (ctx) => {
    try {
      match({ routes, location: ctx.req.url }, (error, redirect, props) => {
        if (error) {
          logger.error(`Server routing error: ${err}`);
          ctx.status = 500;
          ctx.body = err.message;
        } else if (redirect) {
          ctx.redirect(redirect.pathname + redirect.search);
          // Don't render anything if you are requesting an api url aka anything near "/v1"
        } else if (ctx.req.headers && ctx.req.headers.referer && ctx.req.headers.referer.indexOf(`/v1`) !== -1) {
          //
        } else if (props) {
          const serverProps = {
            files: files.getFiles(),
            jobs: jobs.getJobs(),
            bots: bots.getBots(),
            botPresets: bots.getBotPresets(),
          };
          _.extend(props.params, serverProps);
          const appHtml = renderToString(React.createElement(RouterContext, props));
          ctx.body = renderPage(appHtml, serverProps);
        } else {
          ctx.redirect('/');
        }
      });
    } catch (ex) {
      app.context.logger.error(ex);
      ctx.body = `Server Error`;
      ctx.status = 500;
    }
  });

  app.use(router.routes(), router.allowedMethods());

  app.context.logger.info(`Hydra-Print has been initialized successfully.`);

  return app;
});
