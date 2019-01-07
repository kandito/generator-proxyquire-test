const _ = require('lodash');
const chai = require('chai');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const { expect } = chai;
chai.use(require('sinon-chai'));

describe('<%= srcPath %>', () => {<% modules.forEach((obj) => { %>

  const <%= obj.name %> = {<% obj.usedFunctions.forEach((usedFunction) => { %>
    <%- usedFunction %>: _.noop,<% }); %>
    '@noCallThru': true,
  };<% }); -%>


  const testedModule = proxyquire('<%= srcPathInTest %>', {<% modules.forEach((obj) => { %>
    '<%- obj.module %>': <%= obj.name %>,<% }); -%>

  });

  context('your test here', () => {

  });
});
