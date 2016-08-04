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
 -
    ins: B. Trammell
    name: Brian Trammell
    organization: ETH Zurich
    email: ietf@trammell.ch

informative:
  I-D.ietf-taps-transports:

--- abstract

Minimal in-band firewall and load balancer signaling for UDP.

--- middle

# Introduction

This document defines a common minimal path layer protocol for UDP-
encapsulated transport protocols with  in order to provide minimal, transport-
independent state exposure to support firewall and load balancer operation
[EDITOR'S NOTE cite appropriate section of draft-kuehlewind-plus-ps once it
exists].

## Requirements

- Hint to Initiator's network path that PLUS is likely in use
- Hint to Initiator's network path that Initiator wants to initiate a new
  connection
- Further indication to path that PLUS protocol is in use when Responder's
  messages are seen by the path, better than 5-tuple.
- Matching Responder's packets to Initiator's intent to communicate, better
  than 5-tuple

# Terminology

- Initiator: The active opener of a transport-layer association. In a client-
  server protocol, this is generally the client.

- Responder: The listener (passive opener) of a transport-layer association.
  In a client-server protocol, this is generally the server.

- Upper-layer transport: The transport protocol which uses PLUS for
  common signaling.


# Protocol Specification

The PLUS protocol fits between the UDP header and the (encrypted) upper layer
transport header and payload, adding eight bytes to each packet sent by the
initiator, and four bytes to each packet sent by the responder. The initiator's
PLUS header allows elements on the network path that can see both inbound and
outbound traffic for an association (including typical firewalls and load
balancers) to group packets together into flows with better accuracy than
provided by the 5-tuple of (Source Address, Source Port, Destination Address,
Destination Port, Protocol).

## Bit pattern: Initiator {#initiator_bits}

~~~
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|      UDP Source Port          |   UDP Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         UDP Length            |      UDP Checksum             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                             Magic                             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|             Association Token                 |R|X|   tflags  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|              Upper Layer Transport Header/Payload             |
|                             . . .                             |

~~~


The following bits are defined:

* Magic: 32 bits. Magic numbers should be chosen such that they do not appear as
  the first 32 bits of any widely deployed UDP-based protocol, to allow
  initiator packets to be probabilistically separated from reflected UDP
  traffic. For the version of the PLUS protocol described in this document, the
  value of the Magic field is 0xd80000d8.

* Association Token: 24 bits. A cryptographically random token chosen by the
  initiator for this association.

* R bit (Reset): The initiator sets this bit to indicate the association is
  closing.

* X bit (Reserved): Reserved for future use in this protocol. Must be zero.

* tflags: 6 bits: available for use in the next layer

## Bit pattern: Responder {#responder_bits}

~~~
0                   1                   2                   3
0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Source Port           |       Destination Port        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         UDP Length            |          Checksum             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        HMAC                   |R|X|   tflags  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
~~~

The following bits are defined:

* hmac, 24 bits: HMAC_SHA256(magic, ConnectionID), truncated
* R, 1 bit: Reset
* X, 1bits: reserved for future use in this protocol
* tflags: 6 bits: available for use in the next layer

## Indication of implementation

The receiver performs HMAC_256(0xd80000d8, Association Token), and uses the
first 3 bytes as the first 3 bytes of the reply.  This is used as a further
hint that the magic number use was intentional.  Call this function
Indicator(Association Token).

Usefully, none of these truncated HMACs return the magic number.

## Reset bit

Set the Reset bit to tell the path that you're shutting down.  Work will need
to be done on this section to define what actions the path will take; one
possible approach is to shorten the association timer to a smaller, constant
value.

Upper-layer transports should consider providing security around this bit
before trusting that it comes from the other endpoint.

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
  * If not, treat as non-PLUS UDP
* Forward 6tuple = 5tuple + Association Token
* Reverse 6tuple = Reverse 5tuple + Indicator(Association Token)
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
  consider using a different Association Token on different paths to make
  tracking harder.  If so, figure out how load balancers are going to deal with
  the problem.

# Security Considerations {#security}

Next layer transport protocols SHOULD discuss whether any of these bits need
to be protected.

Discuss the actual number of bits that window tracking gives you for TCP.
Contrast this with how useful this would be for tracking people.

Association Tokens MUST NOT be under the control of untrusted code, like
JavaScript.  It's likely there's a reason for making them not available to
untrusted code as well.

# IANA Considerations

Do we need a registry of magic numbers?

--- back
