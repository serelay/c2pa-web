/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { CandidateState } from "./candidateState";
import { MSG } from "./msg"
import "./style.scss";

class CandidateImage {
  url: string
  status: CandidateState

  constructor(url: string, status: CandidateState = CandidateState.PENDING) {
    this.url = url;
    this.status = status;
  }

  scanImage() {
    this.status = CandidateState.PENDING;
    chrome.runtime.sendMessage({
      msg: MSG.PROCESS_IMAGE,
      url: this.url
    });
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.runtime.sendMessage({
    msg: MSG.POPUP_OPENED,
    data: {
      tabId: tabs[0].id
    }
  });
});

const Popup = () => {
  const [currentURL, setCurrentURL] = useState<string>();
  const [currentList, _setCurrentList] = useState(Array<CandidateImage>());
  // Setup so we can listen internally with live state within our own event listener
  const listRef = useRef(currentList);
  const setCurrentList = (list: CandidateImage[]) => {
    listRef.current = list;
    _setCurrentList(list);
  }

  const messageCallback = (message: any) => {
    if (message.msg === undefined) {
      return;
    }
    switch (message.msg) {
      case MSG.JPEGS_FOUND: {
        const jpegs: [string] = message.jpegs;
        const candidates = Array<CandidateImage>();
        if (jpegs === undefined) {
          return;
        }
        jpegs.forEach(url => {
          candidates.push(new CandidateImage(url));
        })
        setCurrentList(candidates);
        candidates.forEach(candidate => {
          candidate.scanImage();
        });
        break;
      }

      case MSG.IMAGE_PROCESSED: {
        const newList = listRef.current?.map((item) => {
          if (item.url === message.url) {
            item.status = message.result.state;
            return item;
          }
          return item;
        });
        setCurrentList(newList);
        break;
      }
    }
  };

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      setCurrentURL(tabs[0].url);
    });
  }, []);

  // Add listener once
  useEffect(() => {
    chrome.runtime.onMessage.addListener(messageCallback);
    return () => {
      chrome.runtime.onMessage.removeListener(messageCallback);
    }
  }, []);

  const renderRows = () => {
    return currentList.map((item, index) =>
      <CandidateComponent key={index + item.url} item={item} />
    );
  }

  return (
    <>
      <ul style={{ minWidth: "500px" }}>
        <li>Current URL: {currentURL}</li>
        <li>Last render Time: {new Date().toLocaleTimeString()}</li>
      </ul>

      <table>
        <thead>
          <tr>
            <th>Image</th>
            <th>State</th>
            <th>Verification link</th>
            <th>Viewer</th>
          </tr>
        </thead>
        <tbody>
          {renderRows()}
        </tbody>
      </table>
    </>
  );
};

const CandidateComponent = (props: {item: CandidateImage}) => {

  const openC2paViewer = (uri: string) => {
    let url = chrome.runtime.getURL("viewer-c2pa.html");
    url += `?uri=${encodeURIComponent(uri)}`
    chrome.tabs.create({ url });
  }

  const renderExternalLink = (status: CandidateState, url: string) => {
    switch (status) {
      case CandidateState.CAI_FOUND: {
        return <a href={`https://verify-alpha.contentauthenticity.org/inspect?tour=1&source=${encodeURIComponent(url)}`} target="_blank">
          Verify <span className="material-icons">open_in_new</span>
        </a>
      }
      case CandidateState.C2PA_FOUND: {
        return "Not yet available"
      }
      default:
        return "N/A for verification"
    }
  }

  const renderInternalLink = (status: CandidateState, url: string) => {
    switch (status) {
      case CandidateState.CAI_FOUND: {
        return "N/A for local verification"
      }
      case CandidateState.C2PA_FOUND: {
        return <a href="#" onClick={ () => openC2paViewer(url) }>Viewer</a>
      }
      default:
        return "N/A for verification"
    }
  }

  return (
    <>
    <React.Fragment>
    <tr>
      <td>
        <img src={props.item.url} width="auto" height="50"/>
      </td>
      <td>
        {props.item.status}
      </td>
      <td>
        {renderExternalLink(props.item.status, props.item.url)}
      </td>
      <td>
        {renderInternalLink(props.item.status, props.item.url)}
      </td>
    </tr>
    </React.Fragment>
  </>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
  document.getElementById("root")
);
