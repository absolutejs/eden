import {expect,test} from 'bun:test';
import {apiError,apiErrorMessage,apiErrorFields,isPaywallError} from '../src';
test('keeps envelope status and does not turn payment-required into a generic failure',()=>{
 const error=apiError({status:402,value:{message:'Add credits to continue.'}});
 expect(isPaywallError(error)).toBe(true); expect(error.message).toBe('Add credits to continue.');
});
test('validation gives field guidance without reflecting values or raw schema',()=>{
 const error=apiError({status:422,value:{errors:[{schemaPath:'#/properties/order_details/properties/tax',params:{type:'number'},message:'must be number',value:'secret'},{fieldName:'billing_address.email',params:{format:'email'},message:'bad secret address'}]}});
 expect(error.status).toBe(422);expect(error.message).toContain('Enter a valid number.');expect(error.message).toContain('Enter a valid email address.');expect(JSON.stringify(error)).not.toContain('secret');
 expect(apiErrorFields(error)).toEqual(error.issues!);expect(apiErrorMessage(error)).toBe(error.message);
});
test('server errors never display provider bodies, even innocent-looking ones',()=>{
 const error=apiError({status:500,value:{message:'password = secret',stack:'private',value:'submitted'}});
 expect(error.message).toContain('Check whether it completed');expect(JSON.stringify(error)).not.toContain('secret');
 expect(apiErrorMessage({status:502,value:'Internal account details'},'Could not load invoices.')).toBe('Could not load invoices.');
});
test('generic errors honor the later action-specific fallback',()=>{
 expect(apiErrorMessage(new Error('Request failed'),'Could not save invoice.')).toBe('Could not save invoice.');
 expect(apiErrorMessage({status:401,value:null})).toContain('Sign in again');
 expect(apiErrorMessage({status:429,value:null})).toContain('Wait a moment');
});
test('plain business errors remain useful while technical strings are suppressed',()=>{
 expect(apiErrorMessage({status:409,value:{message:'This invoice has already been paid.'}})).toBe('This invoice has already been paid.');
 expect(apiErrorMessage(new Error('PostgresError: select password from users'))).not.toContain('password');
 expect(apiErrorMessage('<html>private failure</html>')).not.toContain('<html>');
});
test('malformed and cyclic inputs are bounded',()=>{
 const value:any={status:422};value.value=value;value.errors=[value];
 expect(()=>{ apiError(value); }).not.toThrow();expect(apiErrorFields({errors:Array(100).fill({path:'amount',message:'must be number'})})).toHaveLength(20);
});
