/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { MSG } from "./msg";
import "./style.scss";
import C2PAValidation from "./jumbf/c2paValidation";

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const uri = decodeURIComponent(urlParams.get('uri')!);

export type AssertionResult = {
  hash: string;
  url: string;
  alg: string;
  valid: boolean;
}

chrome.runtime.sendMessage({
  msg: MSG.EXTRACT_IMAGE,
  url: uri
});

let tabId: number;
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  tabId = tabs[0].id!;
});

let originalImage = new Promise<ArrayBuffer>(resolve => {
  fetch(uri, {
    credentials: 'include',
    cache: 'default',
  }).then(response => {
    resolve(response.arrayBuffer());
  });
});

const Viewer = () => {
  // Use references as the Chrome callback occurs later and is lost otherwise.

  const [boxes, _setBoxes] = useState<[any]>();
  const boxesRef = useRef(boxes);
  const setBoxes = (newBoxes: [any]) => {
    boxesRef.current = boxes;
    _setBoxes(newBoxes);
  }
  const [thumbnail, _setThumbnail] = useState<string>();
  const thumbnailRef = useRef(thumbnail);
  const setThumbnail = (thumbnail: string) => {
    thumbnailRef.current = thumbnail;
    _setThumbnail(thumbnail);
  }

  const [signatureValid, _setSignatureValid] = useState<boolean | undefined>(undefined);
  const signatureValidRef = useRef(signatureValid);
  const setSignatureValid = (value: boolean) => {
    signatureValidRef.current = signatureValid;
    _setSignatureValid(value)
  }

  const [assertions, _setAssertions] = useState<Array<AssertionResult>>();
  const assertionRef = useRef(assertions);
  const setAssertions = (results: Array<AssertionResult>) => {
    assertionRef.current = assertions;
    _setAssertions(results);
  }

  const messageCallback = async (message: any) => {
    if (message.msg === undefined) {
      return;
    }
    if (message.tabId != tabId) {
      return;
    }

    switch (message.msg) {
      case MSG.IMAGE_EXTRACTED: {
        setBoxes(message.boxes);
        const contentStarts = message.contentInfo?.contentStarts;
        const contentLengths = message.contentInfo?.contentLengths;
        // Sometimes thumbnail validation will fail - not extracted yet? Not yet loaded on this page?
        await originalImage.then(image => {
          C2PAValidation.performValidations(image, message.boxes, contentStarts, contentLengths).then(
            (result) => {
              setThumbnail(Buffer.from(result.thumbnail).toString('base64'))
              setSignatureValid(result.signature);
              setAssertions(result.assertions);
            }
          );
        });
        break;
      }
    }
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener(messageCallback);
    return () => {
      chrome.runtime.onMessage.removeListener(messageCallback);
    }
  }, []);

  const renderThumbnail = () =>
    <>
      <React.Fragment>
        {thumbnail ? <img src={`data:image/jpeg;base64, ${thumbnail}`} height="200" width="auto" /> : ''}
      </React.Fragment>
    </>;

  // for whatever reason this complains that there is no unique key, despite declaring in an even more unique way than others
  const renderBoxes = () => boxes?.map((box, i) =>
    <React.Fragment key={i + box.label}>
      <tr>
        <td>{box.label}</td>
        <td>{box.json}</td>
      </tr>
    </React.Fragment>
    );

  // This is expensive to call each render (but currently only two renders called)
  const runValidations = () => assertions?.map((assertionResult: AssertionResult) =>
    <React.Fragment key={assertionResult.url}>
      <tr>
        <td>{assertionResult.url}</td>
        <td>{JSON.stringify(assertionResult.valid)}</td>
      </tr>
    </React.Fragment>
  );

  // Tables will do for now. The overall look/feel would be better when it's more user-friendly, but serves purpose for devlopment
  return(
    <>
      <table>
        <thead>
          <tr>
            <th>Original</th>
            <th>Thumbnails</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><img src={uri} height="200" width="auto" /></td>
            <td>
            {renderThumbnail()}
            </td>
          </tr>
        </tbody>
      </table>
      <h2>Validations</h2>
      <table>
        <thead>
          <tr>
            <th>Claim</th>
            <th>Validated</th>
          </tr>
        </thead>
        <tbody>
        {runValidations()}
        <tr>
          <td>Signature</td>
          <td>{JSON.stringify(signatureValid)}</td>
        </tr>
        </tbody>
      </table>
      <h1>Boxes</h1>
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Content</th>
          </tr>
        </thead>
        <tbody>
          {renderBoxes()}
        </tbody>
      </table>
    </>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <Viewer />
  </React.StrictMode>,
  document.getElementById("root")
);
