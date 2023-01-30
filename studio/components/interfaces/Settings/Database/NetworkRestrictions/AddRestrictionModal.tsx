import { FC } from 'react'
import { Address4 } from 'ip-address'
import ipaddr from 'ipaddr.js'
import { Button, Form, IconHelpCircle, Input, Modal } from 'ui'
import * as Tooltip from '@radix-ui/react-tooltip'

import { useStore, useParams } from 'hooks'
import { useNetworkRestrictionsApplyMutation } from 'data/network-restrictions/network-retrictions-apply-mutation'
import InformationBox from 'components/ui/InformationBox'

interface Props {
  restrictedIps: string[]
  visible: boolean
  hasOverachingRestriction: boolean
  onClose: () => void
}

const AddRestrictionModal: FC<Props> = ({
  restrictedIps,
  visible,
  hasOverachingRestriction,
  onClose,
}) => {
  const formId = 'add-restriction-form'
  const { ui } = useStore()
  const { ref } = useParams()
  const { mutateAsync: applyNetworkRestrictions } = useNetworkRestrictionsApplyMutation()

  const getAddressEndRange = (cidr: string) => {
    try {
      const address = new Address4(cidr)
      return { start: address.startAddress().address, end: address.endAddress().address }
    } catch (error: any) {
      return undefined
    }
  }

  const validate = (values: any) => {
    const errors: any = {}
    const { ipAddress, cidrBlockSize } = values

    if (cidrBlockSize < 0 || cidrBlockSize > 32) {
      errors.cidrBlockSize = 'Size has to be between 0 to 32'
    }

    try {
      const address = ipaddr.parse(ipAddress)
      const isIpv6 = address.kind() === 'ipv6'
      const isPrivate = address.range() === 'private'

      if (isIpv6) errors.ipAddress = 'Only IPv4 addresses are supported at the moment'
      else if (isPrivate) errors.ipAddress = 'Private IP addresses are not supported'
    } catch (error: any) {
      errors.ipAddress = 'Please enter a valid IP address'
    }

    // try {
    //   // Check if already exists
    //   const alreadyExists = restrictedIps.includes(values.address)
    //   if (alreadyExists) {
    //     errors.address = 'This restriction already exists'
    //     return errors
    //   }
    //   // Check if valid IP address
    //   const [address, range] = ipaddr.IPv4.parseCIDR(values.address)
    //   // Check if private range
    //   const isPrivate = ipaddr.parse(address.octets.join('.')).range() === 'private'
    //   if (isPrivate) errors.address = 'Private IP addresses are not supported'
    // } catch (error: any) {
    //   if (error.message.includes('string is not formatted like an IPv4 CIDR range')) {
    //     try {
    //       // Check if IPv6 format
    //       ipaddr.IPv6.parseCIDR(values.address)
    //       errors.address = 'Only IPv4 addresses are supported at the moment'
    //     } catch (error: any) {
    //       errors.address = 'Please enter a valid address in CIDR notation'
    //     }
    //   }
    // }
    return errors
  }

  const onSubmit = async (values: any, { setSubmitting }: any) => {
    if (!ref) return console.error('Project ref is required')

    setSubmitting(true)
    const cidr = `${values.ipAddress}/${values.cidrBlockSize}`
    const dbAllowedCidrs = hasOverachingRestriction ? [cidr] : [...restrictedIps, cidr]

    try {
      await applyNetworkRestrictions({ projectRef: ref, dbAllowedCidrs })
      onClose()
    } catch (error: any) {
      ui.setNotification({
        category: 'error',
        message: `Failed to add restriction: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      closable
      hideFooter
      size="medium"
      visible={visible}
      onCancel={onClose}
      header="Add a new restriction"
    >
      <Form
        validateOnBlur
        id={formId}
        className="!border-t-0"
        initialValues={{ ipAddress: '', cidrBlockSize: undefined }}
        validate={validate}
        onSubmit={onSubmit}
      >
        {({ isSubmitting, values }: { isSubmitting: boolean; values: any }) => {
          const isValidBlockSize =
            values.cidrBlockSize !== '' && values.cidrBlockSize >= 0 && values.cidrBlockSize <= 32
          const availableAddresses = Math.pow(2, 32 - (values?.cidrBlockSize ?? 0))
          const addressRange = getAddressEndRange(`${values.ipAddress}/${values.cidrBlockSize}`)

          return (
            <>
              <Modal.Content>
                <div className="py-6 space-y-4">
                  <p className="text-sm text-scale-1100">
                    This will add an IP address range to a list of allowed ranges that can access
                    your project's database.
                  </p>
                  <InformationBox
                    defaultVisibility
                    hideCollapse
                    title="Note: Restrictions only apply to your database and PgBouncer"
                    description="They do not currently apply to APIs offered over HTTPS, such as PostgREST, Storage, or Authentication"
                  />
                  <div className="flex space-x-4">
                    <div className="w-[55%]">
                      <Input
                        label="IPv4 address"
                        id="ipAddress"
                        name="ipAddress"
                        placeholder="0.0.0.0"
                      />
                    </div>
                    <div>
                      <Input
                        label={
                          <div className="flex items-center space-x-2">
                            <p>CIDR Block Size</p>
                            <Tooltip.Root delayDuration={0}>
                              <Tooltip.Trigger>
                                <IconHelpCircle size="tiny" strokeWidth={2} />
                              </Tooltip.Trigger>
                              <Tooltip.Content side="bottom">
                                <Tooltip.Arrow className="radix-tooltip-arrow" />
                                <div
                                  className={[
                                    'rounded bg-scale-100 py-1 px-2 leading-none shadow',
                                    'border border-scale-200 w-[300px]',
                                  ].join(' ')}
                                >
                                  <span className="text-xs text-scale-1200">
                                    Classless inter-domain routing (CIDR) notation is the notation
                                    used to identify networks and hosts in the networks. The block
                                    size tells us how many bits we need to take for the network
                                    prefix, and is a value between 0 to 32.
                                  </span>
                                </div>
                              </Tooltip.Content>
                            </Tooltip.Root>
                          </div>
                        }
                        id="cidrBlockSize"
                        name="cidrBlockSize"
                        type="number"
                        placeholder="0"
                        min={0}
                        max={32}
                      />
                    </div>
                  </div>
                  {isValidBlockSize && (
                    <div className="">
                      <p className="text-sm text-scale-1000">
                        Number of addresses: {availableAddresses}
                      </p>
                      {addressRange !== undefined && (
                        <p className="text-sm text-scale-1000">
                          Selected address space:{' '}
                          <code className="text-xs">{addressRange.start}</code> to{' '}
                          <code className="text-xs">{addressRange.end}</code>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Modal.Content>
              <div className="flex items-center justify-end px-6 py-4 border-t space-x-2">
                <Button type="default" disabled={isSubmitting} onClick={() => onClose()}>
                  Cancel
                </Button>
                <Button htmlType="submit" loading={isSubmitting} disabled={isSubmitting}>
                  Save restriction
                </Button>
              </div>
            </>
          )
        }}
      </Form>
    </Modal>
  )
}

export default AddRestrictionModal