import ships from "../data/ships.json";

(() => {
  const ORIGIN = window.origin;

  function tryResolveCCU(content: { name: string, match_items: { name: string }[], target_items: { name: string }[] }) {
    const name = content.name;

    let from = "";
    let to = "";

    try {
      const regExp = /upgrade\s*-\s*(.*?)\s+to\s+(.*?)(?:\s+\w+\s+edition)/
      const match = name.toLowerCase().match(regExp);

      if (match) {
        from = match[1].trim()
        to = match[2].trim()
      } else {
        from = content.match_items[0].name
        to = content.target_items[0].name
      }

      if (!ships.find(ship => ship.name.toLowerCase().trim() === from.toLowerCase().trim())) {
        from = content.match_items[0].name
      }

      if (!ships.find(ship => ship.name.toLowerCase().trim() === to.toLowerCase().trim())) {
        to = content.target_items[0].name
      }

      if (!from || !to) {
        throw new Error("invalid ccu");
      }
    } catch (error) {
      console.warn("error parsing ccu", name, "error >>>>", error, "reporting");
      reportError({
        errorType: "CCU_PARSING_ERROR",
        errorMessage: JSON.stringify({
          content,
          error: String(error),
        }),
      });
      return false;
    }

    return { from, to };
  }

  function replaceHangarPlaceholderImages() {
    const hangarItemsList = document.querySelectorAll('.list-items>li');

    if (!hangarItemsList.length) {
      requestAnimationFrame(replaceHangarPlaceholderImages);
      return;
    }

    hangarItemsList.forEach(item => {
      const image = item.querySelector('.item-image-wrapper>.image') as HTMLDivElement;

      if (!image) {
        return;
      }

      const backgroundImage = window.getComputedStyle(image).backgroundImage;
      const imageSrc = backgroundImage.replace(/^url\(['"](.+)['"]\)$/, '$1');

      if (imageSrc && imageSrc.includes('default-image.png')) {
        const upgradeDetail = JSON.parse(item.querySelector('.js-upgrade-data')?.getAttribute("value") || "{}");

        const parsed = tryResolveCCU(upgradeDetail);

        if (!parsed) return;

        image.style.backgroundImage = `url(${ships.find(ship => ship.name.toLowerCase().trim() === parsed?.from.toLowerCase().trim())?.medias?.productThumbMediumAndSmall})`;
        image.style.backgroundSize = 'cover';

        const newImage = image.cloneNode(true) as HTMLDivElement;
        newImage.style.backgroundImage = `url(${ships.find(ship => ship.name.toLowerCase().trim() === parsed?.to.toLowerCase().trim())?.medias?.productThumbMediumAndSmall})`;

        const imageWrapper = item.querySelector('.item-image-wrapper') as HTMLDivElement;
        imageWrapper.style.width = "220px"
        imageWrapper.style.display = "flex"
        imageWrapper.style.position = "relative"
        imageWrapper.style.justifyContent = "space-between"
        imageWrapper.style.alignItems = "center"
        imageWrapper.appendChild(newImage);

        const arrowRight = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-right-icon lucide-chevrons-right"><path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/></svg>'
        const arrowRightContainer = document.createElement('div');
        arrowRightContainer.innerHTML = arrowRight;
        arrowRightContainer.style.width = "16px"
        arrowRightContainer.style.height = "16px"
        arrowRightContainer.style.color = "#fff"
        arrowRightContainer.style.position = "absolute"
        arrowRightContainer.style.left = "50%"
        arrowRightContainer.style.top = "50%"
        arrowRightContainer.style.transform = "translate(-50%, -50%)"

        imageWrapper.appendChild(arrowRightContainer);

        const titleWrapper = item.querySelector('.wrapper-col') as HTMLDivElement;
        titleWrapper.style.marginLeft = "260px"
      }
    });
  }

  function replaceBuybackPlaceholderImages() {
    const listItems = document.querySelectorAll('.available-pledges .pledges>li');

    if (!listItems.length) {
      requestAnimationFrame(replaceBuybackPlaceholderImages);
      return;
    }

    const injectCss = `
    .extended-image-wrapper::before {
      width: 230px !important;
    }

    .extended-image-wrapper::after {
      width: 252px !important;
    }
    `

    const style = document.createElement('style');
    style.textContent = injectCss;

    document.head.appendChild(style);

    listItems.forEach((li, index) => {
      const name = li.querySelector("h1")?.textContent;
      const from = li.querySelector("a")?.getAttribute("data-fromshipid");
      const to = li.querySelector("a")?.getAttribute("data-toshipid");
      const toSku = li.querySelector("a")?.getAttribute("data-toskuid");

      const imageWrapper = li.querySelector("figure") as HTMLDivElement;
      const image = li.querySelector("img") as HTMLImageElement;

      image.style.objectFit = "cover"


      const newImage = image.cloneNode(true) as HTMLImageElement;

      if (!from || !to || !name || !toSku) {
        console.warn("error parsing buyback ccu", name, "reporting");
        reportError({
          errorType: "BUYBACK_CCU_PARSING_ERROR",
          errorMessage: JSON.stringify({
            name,
            from,
            to,
            toSku,
            li: li.outerHTML,
          }),
        });
        return;
      }

      const fromShip = ships.find(ship => ship.id === Number(from))
      const toShip = ships.find(ship => ship.id === Number(to))

      const ccu = {
        name,
        from,
        to,
        toSku,
        price: (toShip?.msrp && fromShip?.msrp) ? toShip?.msrp - fromShip?.msrp : 0,
      }

      const parsed = tryResolveCCU({
        name: ccu.name,
        match_items: [{ name: ccu.from }],
        target_items: [{ name: ccu.to }],
      });

      if (parsed) {
        image.src = ships.find(ship => ship.name.toLowerCase().trim() === parsed?.from.toLowerCase().trim())?.medias?.productThumbMediumAndSmall || "";
        newImage.src = ships.find(ship => ship.name.toLowerCase().trim() === parsed?.to.toLowerCase().trim())?.medias?.productThumbMediumAndSmall || "";

        image.style.fillRule = "content-box"

        imageWrapper.removeChild(image);
        imageWrapper.style.width = "254px"
        imageWrapper.classList.add("extended-image-wrapper")

        // imageWrapper.parentElement?.removeChild(imageWrapper);

        const newImageWrapper = document.createElement('div');
        newImageWrapper.style.width = "230px"
        newImageWrapper.style.display = "flex"
        newImageWrapper.style.position = "relative"
        newImageWrapper.style.justifyContent = "space-between"
        newImageWrapper.style.alignItems = "center"
        newImageWrapper.appendChild(image);
        newImageWrapper.appendChild(newImage);

        const arrowRight = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-right-icon lucide-chevrons-right"><path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/></svg>'
        const arrowRightContainer = document.createElement('div');
        arrowRightContainer.innerHTML = arrowRight;
        arrowRightContainer.style.width = "24px"
        arrowRightContainer.style.height = "24px"
        arrowRightContainer.style.color = "#fff"
        arrowRightContainer.style.position = "absolute"
        arrowRightContainer.style.left = "50%"
        arrowRightContainer.style.top = "50%"
        arrowRightContainer.style.transform = "translate(-50%, -50%)"

        newImageWrapper.appendChild(arrowRightContainer);

        imageWrapper.appendChild(newImageWrapper);
      }
    });
  }

  if (window.location.pathname === "/en/account/pledges") {
    replaceHangarPlaceholderImages();
  }

  if (window.location.pathname === "/en/account/buy-back-pledges") {
    replaceBuybackPlaceholderImages();
  }

  (function initialize() {
    let port;
    let resolveConnectionPromise;
    let connectionPromise = new Promise(resolve => {
      resolveConnectionPromise = resolve;
    });
    let pendingMessage = null;

    function connectToExtension() {
      port = chrome.runtime.connect();
      console.log('loaded');
      resolveConnectionPromise();

      port.onDisconnect.addListener(() => {
        connectionPromise = new Promise(resolve => {
          resolveConnectionPromise = resolve;
        });
        connectToExtension();
      });

      port.onMessage.addListener(message => {
        pendingMessage = null;
        window.postMessage({
          type: 'ccuPlannerAppIntegrationResponse',
          message: message
        }, ORIGIN);
      });

      if (pendingMessage !== null) {
        port.postMessage(pendingMessage);
      }
    }

    function setupMessageHandling() {
      connectToExtension();

      window.addEventListener('message', async (event) => {
        if (event.source === window && event.data && event.data.type === 'ccuPlannerAppIntegrationRequest') {
          await connectionPromise;
          pendingMessage = event.data.message;
          port.postMessage(event.data.message);
        }
      }, false);

      const integrationMarker = document.createElement('meta');
      integrationMarker.setAttribute('name', '__ccu_planner_app_integration');
      (document.head || document.documentElement).appendChild(integrationMarker);
    }

    window.addEventListener('DOMContentLoaded', () => {
      setupMessageHandling();
    });
  })();
})();