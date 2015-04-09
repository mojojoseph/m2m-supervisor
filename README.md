M2M-SUPERVISOR 
====

[![Build Status](https://travis-ci.org/numerex/m2m-supervisor.svg)](https://travis-ci.org/numerex/m2m-supervisor)
[![Coverage Status](https://coveralls.io/repos/numerex/m2m-supervisor/badge.svg?branch=master)](https://coveralls.io/r/numerex/m2m-supervisor?branch=master)

The M2M-SUPERVISOR contains a set of processes that can run on an embedded processing platform (such as the Beaglebone)
that can perform the following tasks:

* Ensure that a cellular wireless connection (PPP) is continuously available
* Provide public and private data routing to a "mothership" services platform
* Perform "least-cost-routing" based on configuration using public/private pathways
* Coordinate Mobile Originated (MO) and Terminated (MT) messaging
* Provide a framework for application-specific processing of business logic