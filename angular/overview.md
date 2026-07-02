# Overview

The **"OpenText Enterprise Performance Engineering CI"** extension allows Azure DevOps Server pipelines to run performance tests managed in OpenText Enterprise Performance Engineering (LRE) as a native build or release task.

## This extension currently supports:

* The three latest versions of OpenText Enterprise Performance Engineering.

## System prerequisites

* An OpenText Enterprise Performance Engineering server accessible from the Azure DevOps agent host.
* Azure DevOps agent v3.x (recommended) or v2.x with Node 20 externals installed. The agent supplies Node.js automatically — no separate Node.js installation is required.
