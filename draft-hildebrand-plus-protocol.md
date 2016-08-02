---
title: PLUS Protocol
abbrev: plus-protocol
docname: draft-hildebrand-plus-protocol
date:
category: std
ipr: trust200902

author:
 -
    ins: J. Hildebrand
    name: Joe Hildebrand
    organization: Cisco Systems
    email: jhildebr@cisco.com

informative:
  I-D.ietf-taps-transports:

--- abstract

Minimal in-band firewall and load balancer signaling for UDP.

--- middle

# Introduction

## Terms

- Initiator: The program initiating the protocol exchange.  Often thought of
  as the "client" in a client-server protocol.
- Responder: The program receiving the initiation request.  Often thought of
  as the "server" in a client-server protocol.
- Transport' protocol: the layer inside PLUS that is providing semantics
  such as those described in {{I-D.ietf-taps-transports}}.

## Requirements

- Hint to Initiator's network path that PLUS is likely in use
- Hint to Initiator's network path that Initiator wants to initiate a new
  connection
- Further indication to path that PLUS protocol is in use when Responder's
  messages are seen by the path, better than 5-tuple.
- Matching Responder's packets to Initiator's intent to communicate, better
  than 5-tuple

# Protocol

## Bit pattern: Initiator {#initiator_bits}

~~~
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       magic = 0xd80000d8                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                               |R|R|           |
|                Conection ID                   |S|S|   tflags  |
|                                               |T|V|           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
~~~

The following bits are defined:

* Magic Constant, 32 bits
* Connection ID, 24 bits
* RST, 1 bit: Reset
* RSV, 1bits: reserved for future use in this protocol
* tflags: 6 bits: available for use in the next layer

More about the magic number, how it was found, how you could generate new
ones.  The magic number is also effectively a version number for this layer.

## Bit pattern: Responder {#responder_bits}

~~~
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                               |R|R|           |
|                        hmac                   |S|S|   tflags  |
|                                               |T|V|           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
~~~

The following bits are defined:

* hmac, 24 bits: HMAC_SHA256(magic, ConnectionID), truncated
* RST, 1 bit: Reset
* RSV, 1bits: reserved for future use in this protocol
* tflags: 6 bits: available for use in the next layer

## Indication of implementation

The receiver performs HMAC_256(0xd80000d8, ConnectionID), and uses the
first 3 bytes as the first 3 bytes of the reply.  This is used as a further
hint that the magic number use was intentional.  Call this function
Indicator(ConnectionID).

Usefully, none of these truncated HMACs return the magic number.

# Processing

Basic idea: Initiator sends bits defined in {{initiator_bits}}, Responder
sends bits defined in {{responder_bits}}.  Initiator always has to send first
over every new path.

## Processing by applications

* If the RSV bit is set, ignore the packet
* Initiator: If the hmac doesn't match what you expect, it's either an attack
  or leftover traffic from a previous connection.  Maybe send an unsigned RST?
  (maybe this is a policy or transport-specific decision)
* Responder: If the magic number isn't there, it's likely an attack.  Probably
  best to ignore it.

## Processing by path elements

* Assume that all bits are protected by next layer, so you can't change them.
  Even if you could change them, you may as well just drop the packet, since
  delivery won't work.
* Don't think that having RSV set means this is an attack.  It's just
  something we haven't specified as of the time you wrote your code.

## From inside to outside:

* Match magic number
  * If not, treat as non-PLUS UDP; use port for example
* Forward 6tuple = 5tuple + ConnectionID
* Reverse 6tuple = Reverse 5tuple + Indicator(ConnectionID)
* Look up Forward
  * If not, create state keyed by Forward and Reverse
* Reset timer
  * When timer fires, either drop state or send RST hint both ways without
    e2e crypto
* Allow

## From outside to inside:

* Look up Reverse, allow if match
  * If not, treat as non-PLUS UDP

(TODO: determine if reverse timer is useful)

# Guidelines for next layer

New transport' protocols like QUIC.

* Define tflags as you see fit
* Consider if these bits need protection.  At least tflags do.
* Consider multipath consequences, send before you receive on each path, and
  consider using a different ConnectionID on different paths to make tracking
  harder.  If so, figure out how load balancers are going to deal with the
  problem.

# Security Considerations {#security}

Next layer transport protocols SHOULD discuss whether any of these bits need
to be protected.

Discuss the actual number of bits that window tracking gives you for TCP.
Contrast this with how useful this would be for tracking people.

ConnectionID's MUST NOT be under the control of untrusted code, like
JavaScript.  It's likely there's a reason for making them not available to
untrusted code as well.

# IANA Considerations

Do we need a registry of magic numbers?

--- back
