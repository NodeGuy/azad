/* Copyright(c) 2023 Philip Mulcahy. */

import * as item from './item';
import * as extraction from './extraction';
import * as util from './util';


const EXAMPLE_FULL_ITEM_LINK_PATH = "//div[contains(@class, 'a-box shipment')]//a[@class='a-link-normal' and contains(@href, '/gp/product/') and normalize-space(text())]";

const FULL_SHIPMENT_PATH = "//div[contains(@class, 'shipment')]";

const ITEM_LINK_FROM_SHIPMENT = "//a[@class='a-link-normal' and contains(@href, '/gp/product/') and normalize-space(text())]";
const PRICE_SPAN_FROM_ITEM_LINK = "/../../div[@class='a-row']/span[contains(@class,'a-color-price')]/nobr/text()";

export interface ITransaction {
  payment_amount: string;
  info_string: string;
}

export interface IShipment {
  // items: item.IItem[],
  delivered: boolean;
  status: string;
  tracking_link: string;
  transaction: ITransaction|null
};

function get_transactions(order_detail_doc: HTMLDocument): ITransaction[] {
  const transaction_elems = util.findMultipleNodeValues(
    "//span[normalize-space(text())= 'Transactions']/../../div[contains(@class, 'expander')]/div[contains(@class, 'a-row')]/span/nobr/..",
    order_detail_doc.documentElement);
  const transactions = transaction_elems.map(e => transaction_from_elem(e as HTMLElement));
  return transactions;
}

function transaction_from_elem(elem: HTMLElement): ITransaction {
  function enthusiastically_strip(e: Node): string {
    return util.defaulted(e.textContent, '').replace(/\s\s+/g, ' ').trim();
  }
  const info_string = enthusiastically_strip(elem.childNodes[0]);
  const payment_amount = enthusiastically_strip(elem.childNodes[1]);
  return {
    payment_amount: payment_amount,
    info_string: info_string,
  }
}

export function get_shipments(order_detail_doc: HTMLDocument): IShipment[] {
  if (order_detail_doc.URL.includes('205-9714306-6543524')) {
    console.log('shipment.getShipments processing 205-9714306-6543524')
  }
  const transactions = get_transactions(order_detail_doc);

  const doc_elem = order_detail_doc.documentElement;

  const candidates = util.findMultipleNodeValues(
		"//div[contains(@class, 'shipment')]",
		doc_elem);

  // We want elem to have 'shipment' as one of its classes
  // not just have one of its classes _contain_ 'shipment' in its name.
  // There may be a way to do this in xpath, but it wouldn't be very
  // readable, and I am also a bit short on sleep.
  const elems = candidates.filter(
		  elem => {
				const cs: string = util.defaulted(
					(elem as HTMLElement)!.getAttribute('class'), '');
				const classes: string[] = cs.split(' ');
				return classes.includes('shipment');
			});

  const shipments = elems.map(e => shipment_from_elem(e as HTMLElement));

  if (shipments.length == transactions.length) {
    for (let i=0; i!=shipments.length; ++i) {
      shipments[i].transaction = transactions[i];
    }
  }
  return shipments;
}

function shipment_from_elem(shipment_elem: HTMLElement): IShipment {
  return {
    delivered: is_delivered(shipment_elem),
    status: get_status(shipment_elem),
    tracking_link: tracking_link(shipment_elem),
    transaction: null,
  };
}

function is_delivered(shipment_elem: HTMLElement): boolean {
  const attr = shipment_elem.getAttribute('class');
  return util.defaulted(
    (attr as string).includes('shipment-is-delivered'), false);
}

function get_status(shipment_elem: HTMLElement): string {
  try {
    const elem = util.findSingleNodeValue(
      "//div[contains(@class, 'shipment-info-container')]//div[@class='a-row']/span",
      shipment_elem,
      'shipment.status'
    );
    return util.defaulted((elem as HTMLElement)!.textContent!.trim(), '');
  } catch(err) {
    console.log('shipment.status got ', err);
    return 'UNKNOWN';
  }
}

function tracking_link(shipment_elem: HTMLElement): string {
  return util.defaulted_call(
    () => {
      const link_elem = util.findSingleNodeValue(
        "//a[contains(@href, '/progress-tracker/')]",
        shipment_elem,
        'shipment.tracking_link'
      );
      return util.defaulted((link_elem as HTMLElement).getAttribute('href'), '');
    },
    ''
  );
}

// function items(shipment_elem: HTMLElement): item.IItem[] {
// }
