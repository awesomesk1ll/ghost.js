import {GProxy} from '../GProxy';

const argv = require('yargs').config().argv;
const gproxy = GProxy.run(argv);

gproxy.start();